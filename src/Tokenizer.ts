import decodeCodePoint from "entities/lib/decode_codepoint";
import entityMap from "entities/lib/maps/entities.json";
import legacyMap from "entities/lib/maps/legacy.json";
import xmlMap from "entities/lib/maps/xml.json";

/** All the states the tokenizer can be in. */
const enum State {
    Text = 1,
    BeforeTagName, // After <
    InTagName,
    InSelfClosingTag,
    BeforeClosingTagName,
    InClosingTagName,
    AfterClosingTagName,

    // Attributes
    BeforeAttributeName,
    InAttributeName,
    InAttributeNameAfterInterpolate,
    AfterAttributeName,
    BeforeAttributeValue,

    // [group] DONT REORDER
    InAttributeValueDq = 20, // "
    InAttributeValueDqAfterInterpolate, // "
    InAttributeValueSq, // '
    InAttributeValueSqAfterInterpolate, // '
    InAttributeValueNq,
    InAttributeValueNqAfterInterpolate,
    // [/group]

    // Declarations
    BeforeDeclaration, // !
    InDeclaration,

    // Processing instructions
    InProcessingInstruction, // ?

    // Comments
    BeforeComment,
    InComment,
    InSpecialComment,
    AfterComment1,
    AfterComment2,

    // Cdata
    BeforeCdata1, // [
    BeforeCdata2, // C
    BeforeCdata3, // D
    BeforeCdata4, // A
    BeforeCdata5, // T
    BeforeCdata6, // A
    InCdata, // [
    AfterCdata1, // ]
    AfterCdata2, // ]

    // Special tags
    BeforeSpecialS, // S
    BeforeSpecialSEnd, // S

    BeforeScript1, // C
    BeforeScript2, // R
    BeforeScript3, // I
    BeforeScript4, // P
    BeforeScript5, // T
    AfterScript1, // C
    AfterScript2, // R
    AfterScript3, // I
    AfterScript4, // P
    AfterScript5, // T

    BeforeStyle1, // T
    BeforeStyle2, // Y
    BeforeStyle3, // L
    BeforeStyle4, // E
    AfterStyle1, // T
    AfterStyle2, // Y
    AfterStyle3, // L
    AfterStyle4, // E

    BeforeSpecialT, // T
    BeforeSpecialTEnd, // T
    BeforeTitle1, // I
    BeforeTitle2, // T
    BeforeTitle3, // L
    BeforeTitle4, // E
    AfterTitle1, // I
    AfterTitle2, // T
    AfterTitle3, // L
    AfterTitle4, // E

    BeforeEntity, // &
    BeforeNumericEntity, // #
    InNamedEntity,
    InNumericEntity,
    InHexEntity, // X

    BeforeTemplate1, // E
    BeforeTemplate2, // M
    BeforeTemplate3, // P
    BeforeTemplate4, // L
    BeforeTemplate5, // A
    BeforeTemplate6, // T
    BeforeTemplate7, // E
    AfterTemplate1, // E
    AfterTemplate2, // M
    AfterTemplate3, // P
    AfterTemplate4, // L
    AfterTemplate5, // A
    AfterTemplate6, // T
    AfterTemplate7, // E

    // Interpolations
    BeforeInterpolate, // {
    InInterpolate,
    AfterInterpolate, // }
}

const enum Special {
    None = 1,
    Script,
    Style,
    Title,
    Template,
}

function whitespace(c: string): boolean {
    return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r";
}

function isASCIIAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

export interface Callbacks {
    onattribdata(value: string, isInterpolate: boolean): void;
    onattribend(quote: string | undefined | null): void;
    onattribname(name: string, isInterpolate: boolean): void;
    oncdata(data: string): void;
    onclosetag(name: string): void;
    oncomment(data: string): void;
    ondeclaration(content: string): void;
    onend(): void;
    onerror(error: Error, state?: State): void;
    onopentagend(): void;
    onopentagname(name: string): void;
    onprocessinginstruction(instruction: string): void;
    onselfclosingtag(): void;
    ontext(value: string, isInterpolate: boolean): void;
}

function ifElseState(upper: string, SUCCESS: State, FAILURE: State) {
    const lower = upper.toLowerCase();

    if (upper === lower) {
        return (t: Tokenizer, c: string) => {
            if (c === lower) {
                t._state = SUCCESS;
            } else {
                t._state = FAILURE;
                t._index--;
            }
        };
    }
    return (t: Tokenizer, c: string) => {
        if (c === lower || c === upper) {
            t._state = SUCCESS;
        } else {
            t._state = FAILURE;
            t._index--;
        }
    };
}

function consumeSpecialNameChar(upper: string, NEXT_STATE: State) {
    const lower = upper.toLowerCase();

    return (t: Tokenizer, c: string) => {
        if (c === lower || c === upper) {
            t._state = NEXT_STATE;
        } else {
            t._state = State.InTagName;
            t._index--; // Consume the token again
        }
    };
}

const stateBeforeCdata1 = ifElseState(
    "C",
    State.BeforeCdata2,
    State.InDeclaration
);
const stateBeforeCdata2 = ifElseState(
    "D",
    State.BeforeCdata3,
    State.InDeclaration
);
const stateBeforeCdata3 = ifElseState(
    "A",
    State.BeforeCdata4,
    State.InDeclaration
);
const stateBeforeCdata4 = ifElseState(
    "T",
    State.BeforeCdata5,
    State.InDeclaration
);
const stateBeforeCdata5 = ifElseState(
    "A",
    State.BeforeCdata6,
    State.InDeclaration
);

const stateBeforeScript1 = consumeSpecialNameChar("R", State.BeforeScript2);
const stateBeforeScript2 = consumeSpecialNameChar("I", State.BeforeScript3);
const stateBeforeScript3 = consumeSpecialNameChar("P", State.BeforeScript4);
const stateBeforeScript4 = consumeSpecialNameChar("T", State.BeforeScript5);

const stateAfterScript1 = ifElseState("R", State.AfterScript2, State.Text);
const stateAfterScript2 = ifElseState("I", State.AfterScript3, State.Text);
const stateAfterScript3 = ifElseState("P", State.AfterScript4, State.Text);
const stateAfterScript4 = ifElseState("T", State.AfterScript5, State.Text);

const stateBeforeStyle1 = consumeSpecialNameChar("Y", State.BeforeStyle2);
const stateBeforeStyle2 = consumeSpecialNameChar("L", State.BeforeStyle3);
const stateBeforeStyle3 = consumeSpecialNameChar("E", State.BeforeStyle4);

const stateAfterStyle1 = ifElseState("Y", State.AfterStyle2, State.Text);
const stateAfterStyle2 = ifElseState("L", State.AfterStyle3, State.Text);
const stateAfterStyle3 = ifElseState("E", State.AfterStyle4, State.Text);

const stateBeforeTitle1 = consumeSpecialNameChar("T", State.BeforeTitle2);
const stateBeforeTitle2 = consumeSpecialNameChar("L", State.BeforeTitle3);
const stateBeforeTitle3 = consumeSpecialNameChar("E", State.BeforeTitle4);

const stateAfterTitle1 = ifElseState("T", State.AfterTitle2, State.Text);
const stateAfterTitle2 = ifElseState("L", State.AfterTitle3, State.Text);
const stateAfterTitle3 = ifElseState("E", State.AfterTitle4, State.Text);

const stateBeforeTemplate1 = consumeSpecialNameChar("M", State.BeforeTemplate2);
const stateBeforeTemplate2 = consumeSpecialNameChar("P", State.BeforeTemplate3);
const stateBeforeTemplate3 = consumeSpecialNameChar("L", State.BeforeTemplate4);
const stateBeforeTemplate4 = consumeSpecialNameChar("A", State.BeforeTemplate5);
const stateBeforeTemplate5 = consumeSpecialNameChar("T", State.BeforeTemplate6);
const stateBeforeTemplate6 = consumeSpecialNameChar("E", State.BeforeTemplate7);

const stateAfterTemplate1 = ifElseState("M", State.AfterTemplate2, State.Text);
const stateAfterTemplate2 = ifElseState("P", State.AfterTemplate3, State.Text);
const stateAfterTemplate3 = ifElseState("L", State.AfterTemplate4, State.Text);
const stateAfterTemplate4 = ifElseState("A", State.AfterTemplate5, State.Text);
const stateAfterTemplate5 = ifElseState("T", State.AfterTemplate6, State.Text);
const stateAfterTemplate6 = ifElseState("E", State.AfterTemplate7, State.Text);


const stateBeforeEntity = ifElseState(
    "#",
    State.BeforeNumericEntity,
    State.InNamedEntity
);
const stateBeforeNumericEntity = ifElseState(
    "X",
    State.InHexEntity,
    State.InNumericEntity
);

export default class Tokenizer {
    /** The current state the tokenizer is in. */
    _state = State.Text;
    /** The read buffer. */
    private buffer = "";
    /** The beginning of the section that is currently being read. */
    public sectionStart = 0;
    /** The index within the buffer that we are currently looking at. */
    _index = 0;
    /**
     * Data that has already been processed will be removed from the buffer occasionally.
     * `_bufferOffset` keeps track of how many characters have been removed, to make sure position information is accurate.
     */
    private bufferOffset = 0;
    /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
    private baseState = State.Text;
    /** Indicates whether the tokenizer has just read a backslash. */
    private escaping = false;
    /** For special parsing behavior inside of script and style tags. */
    private special = Special.None;
    /** Indicates whether the tokenizer has been paused. */
    private running = true;
    /** Indicates whether the tokenizer has finished running / `.end` has been called. */
    private ended = false;

    private readonly cbs: Callbacks;
    private readonly xmlMode: boolean;
    private readonly decodeEntities: boolean;

    constructor(
        options: { xmlMode?: boolean; decodeEntities?: boolean } | null,
        cbs: Callbacks
    ) {
        this.cbs = cbs;
        this.xmlMode = !!options?.xmlMode;
        this.decodeEntities = options?.decodeEntities ?? true;
    }

    public reset(): void {
        this._state = State.Text;
        this.buffer = "";
        this.sectionStart = 0;
        this._index = 0;
        this.bufferOffset = 0;
        this.baseState = State.Text;
        this.special = Special.None;
        this.running = true;
        this.ended = false;
    }

    public write(chunk: string): void {
        if (this.ended) this.cbs.onerror(Error(".write() after done!"));
        this.buffer += chunk;
        this.parse();
    }

    public end(chunk?: string): void {
        if (this.ended) this.cbs.onerror(Error(".end() after done!"));
        if (chunk) this.write(chunk);
        this.ended = true;
        if (this.running) this.finish();
    }

    public pause(): void {
        this.running = false;
    }

    public resume(): void {
        this.running = true;
        if (this._index < this.buffer.length) {
            this.parse();
        }
        if (this.ended) {
            this.finish();
        }
    }

    /**
     * The current index within all of the written data.
     */
    public getAbsoluteIndex(): number {
        return this.bufferOffset + this._index;
    }

    private stateText(c: string) {
        if (c === "<") {
            if (this._index > this.sectionStart) {
                this.cbs.ontext(this.getSection(), false);
            }
            this._state = State.BeforeTagName;
            this.sectionStart = this._index;
        } else if (
            this.decodeEntities &&
            c === "&" &&
            (this.special === Special.None || this.special === Special.Title)
        ) {
            if (this._index > this.sectionStart) {
                this.cbs.ontext(this.getSection(), false);
            }
            this.baseState = State.Text;
            this._state = State.BeforeEntity;
            this.sectionStart = this._index;
        } else {
            this.checkForInterpolate(c, State.Text);
        }
    }
    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */
    private isTagStartChar(c: string) {
        return (
            isASCIIAlpha(c) ||
            (this.xmlMode && !whitespace(c) && c !== "/" && c !== ">")
        );
    }
    private stateBeforeTagName(c: string) {
        if (c === "/") {
            this._state = State.BeforeClosingTagName;
        } else if (c === "<") {
            this.cbs.ontext(this.getSection(), false);
            this.sectionStart = this._index;
        } else if (
            c === ">" ||
            this.special !== Special.None ||
            whitespace(c)
        ) {
            this._state = State.Text;
        } else if (c === "!") {
            this._state = State.BeforeDeclaration;
            this.sectionStart = this._index + 1;
        } else if (c === "?") {
            this._state = State.InProcessingInstruction;
            this.sectionStart = this._index + 1;
        } else if (!this.isTagStartChar(c)) {
            this._state = State.Text;
        } else {
            this._state =
                !this.xmlMode && (c === "s" || c === "S")
                    ? State.BeforeSpecialS
                    : !this.xmlMode && (c === "t" || c === "T")
                    ? State.BeforeSpecialT
                    : State.InTagName;
            this.sectionStart = this._index;
        }
    }
    private stateInTagName(c: string) {
        if (c === "/" || c === ">" || whitespace(c)) {
            this.emitToken("onopentagname");
            this._state = State.BeforeAttributeName;
            this._index--;
        }
    }
    private stateBeforeClosingTagName(c: string) {
        if (whitespace(c)) {
            // Ignore
        } else if (c === ">") {
            this._state = State.Text;
        } else if (this.special !== Special.None) {
            if (this.special !== Special.Title && this.special !== Special.Template && (c === "s" || c === "S")) {
                this._state = State.BeforeSpecialSEnd;
            } else if (
                (this.special === Special.Title || this.special === Special.Template) &&
                (c === "t" || c === "T")
            ) {
                this._state = State.BeforeSpecialTEnd;
            } else {
                this._state = State.Text;
                this._index--;
            }
        } else if (!this.isTagStartChar(c)) {
            this._state = State.InSpecialComment;
            this.sectionStart = this._index;
        } else {
            this._state = State.InClosingTagName;
            this.sectionStart = this._index;
        }
    }
    private stateInClosingTagName(c: string) {
        if (c === ">" || whitespace(c)) {
            this.emitToken("onclosetag");
            this._state = State.AfterClosingTagName;
            this._index--;
        }
    }
    private stateAfterClosingTagName(c: string) {
        // Skip everything until ">"
        if (c === ">") {
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        }
    }
    private stateBeforeAttributeName(c: string) {
        if (c === ">") {
            this.cbs.onopentagend();
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        } else if (c === "/") {
            this._state = State.InSelfClosingTag;
        } else if (!whitespace(c)) {
            this._state = State.InAttributeName;
            this.sectionStart = this._index;
            this.checkForInterpolate(c, State.InAttributeName)
        }
    }
    private stateInSelfClosingTag(c: string) {
        if (c === ">") {
            this.cbs.onselfclosingtag();
            this._state = State.Text;
            this.sectionStart = this._index + 1;
            this.special = Special.None; // Reset special state, in case of self-closing special tags
        } else if (!whitespace(c)) {
            this._state = State.BeforeAttributeName;
            this._index--;
        }
    }
    private stateInAttributeName(c: string) {
        if (c === "=" || c === "/" || c === ">" || whitespace(c)) {
            this.emitToken('onattribname');
            this._state = State.AfterAttributeName;
            this._index--;
        } else {
            this.checkForInterpolate(c, State.InAttributeName);
        }
    }
    private stateAfterAttributeName(c: string) {
        if (c === "=") {
            this._state = State.BeforeAttributeValue;
        } else if (c === "/" || c === ">") {
            this.cbs.onattribend(undefined);
            this._state = State.BeforeAttributeName;
            this._index--;
        } else if (!whitespace(c)) {
            this.cbs.onattribend(undefined);
            this._state = State.InAttributeName
            this.sectionStart = this._index;
            this.checkForInterpolate(c, State.InAttributeName)
        }
    }
    private stateBeforeAttributeValue(c: string) {
        if (c === '"') {
            this._state = State.InAttributeValueDq;
            this.sectionStart = this._index + 1;
        } else if (c === "'") {
            this._state = State.InAttributeValueSq;
            this.sectionStart = this._index + 1;
        } else if (!whitespace(c)) {
            this._state = State.InAttributeValueNq;
            this.sectionStart = this._index;
            this._index--; // Reconsume token
        }
    }
    private handleInAttributeValue(c: string, quote: string) {
        if (c === quote) {
            this.emitAttribData()
            this.cbs.onattribend(quote);
            this._state = State.BeforeAttributeName;
        } else if (this.decodeEntities && c === "&") {
            this.emitAttribData()
            this.baseState = this._state;
            this._state = State.BeforeEntity;
            this.sectionStart = this._index;
        } else {
            this.checkForInterpolate(c, this._state + (this._state % 2 === 0 ? 1 : -1));
        }

    }
    private stateInAttributeValueDoubleQuotes(c: string) {
        this.handleInAttributeValue(c, '"');
    }
    private stateInAttributeValueSingleQuotes(c: string) {
        this.handleInAttributeValue(c, "'");
    }
    private stateInAttributeValueNoQuotes(c: string) {
        if (whitespace(c) || c === ">") {
            this.emitAttribData()
            this.cbs.onattribend(null);
            this._state = State.BeforeAttributeName;
            this._index--;
        } else if (this.decodeEntities && c === "&") {
            this.emitAttribData()
            this.baseState = this._state;
            this._state = State.BeforeEntity;
            this.sectionStart = this._index;
        }
    }
    private stateBeforeInterpolate(c: string) {
        if (c === '{') {
            const section = this.buffer.substring(this.sectionStart, this._index - 1)
            if (section.length > 0) {
                if (this.baseState >= State.InAttributeValueDq && this.baseState <= State.InAttributeValueNqAfterInterpolate) {
                    this.cbs.onattribdata(section, false);
                }
                else if (this.baseState === State.InAttributeName || this.baseState === State.InAttributeNameAfterInterpolate) {
                    this.cbs.onattribname(section, false);
                }
                else if (this._index - 1 > this.sectionStart) {
                    this.cbs.ontext(section, false);
                }
            }
            this._state = State.InInterpolate;
            this.sectionStart = this._index - 1;
        } else {
            this._state = this.baseState;
            this._index--; // Consume the token again
        }
    }
    private stateInInterpolate(c: string) {
        if (c === '}') {
            this._state = State.AfterInterpolate;
        }
    }
    private stateAfterInterpolate(c: string) {
        if (c === '}') {
            const section = this.buffer.substring(this.sectionStart+2, this._index-1)

            if (this.baseState >= State.InAttributeValueDq && this.baseState <= State.InAttributeValueNqAfterInterpolate) {
                this.cbs.onattribdata(section, true)
            }
            else if (this.baseState === State.InAttributeName) {
                this.cbs.onattribname(section, true)
            }
            else if (this.baseState === State.Text) {
                this.cbs.ontext(section, true)
            }

            this.sectionStart = this._index + 1;
            this._state = this.baseState;
        }
        else {
            this._state = State.InInterpolate;
            this._index--; // Consume the token again
        }
    }
    private stateBeforeDeclaration(c: string) {
        this._state =
            c === "["
                ? State.BeforeCdata1
                : c === "-"
                ? State.BeforeComment
                : State.InDeclaration;
    }
    private stateInDeclaration(c: string) {
        if (c === ">") {
            this.cbs.ondeclaration(this.getSection());
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        }
    }
    private stateInProcessingInstruction(c: string) {
        if (c === ">") {
            this.cbs.onprocessinginstruction(this.getSection());
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        }
    }
    private stateBeforeComment(c: string) {
        if (c === "-") {
            this._state = State.InComment;
            this.sectionStart = this._index + 1;
        } else {
            this._state = State.InDeclaration;
        }
    }
    private stateInComment(c: string) {
        if (c === "-") this._state = State.AfterComment1;
    }
    private stateInSpecialComment(c: string) {
        if (c === ">") {
            this.cbs.oncomment(
                this.buffer.substring(this.sectionStart, this._index)
            );
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        }
    }
    private stateAfterComment1(c: string) {
        if (c === "-") {
            this._state = State.AfterComment2;
        } else {
            this._state = State.InComment;
        }
    }
    private stateAfterComment2(c: string) {
        if (c === ">") {
            // Remove 2 trailing chars
            this.cbs.oncomment(
                this.buffer.substring(this.sectionStart, this._index - 2)
            );
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        } else if (c !== "-") {
            this._state = State.InComment;
        }
        // Else: stay in AFTER_COMMENT_2 (`--->`)
    }
    private stateBeforeCdata6(c: string) {
        if (c === "[") {
            this._state = State.InCdata;
            this.sectionStart = this._index + 1;
        } else {
            this._state = State.InDeclaration;
            this._index--;
        }
    }
    private stateInCdata(c: string) {
        if (c === "]") this._state = State.AfterCdata1;
    }
    private stateAfterCdata1(c: string) {
        if (c === "]") this._state = State.AfterCdata2;
        else this._state = State.InCdata;
    }
    private stateAfterCdata2(c: string) {
        if (c === ">") {
            // Remove 2 trailing chars
            this.cbs.oncdata(
                this.buffer.substring(this.sectionStart, this._index - 2)
            );
            this._state = State.Text;
            this.sectionStart = this._index + 1;
        } else if (c !== "]") {
            this._state = State.InCdata;
        }
        // Else: stay in AFTER_CDATA_2 (`]]]>`)
    }
    private stateBeforeSpecialS(c: string) {
        if (c === "c" || c === "C") {
            this._state = State.BeforeScript1;
        } else if (c === "t" || c === "T") {
            this._state = State.BeforeStyle1;
        } else {
            this._state = State.InTagName;
            this._index--; // Consume the token again
        }
    }
    private stateBeforeSpecialSEnd(c: string) {
        if (this.special === Special.Script && (c === "c" || c === "C")) {
            this._state = State.AfterScript1;
        } else if (this.special === Special.Style && (c === "t" || c === "T")) {
            this._state = State.AfterStyle1;
        } else this._state = State.Text;
    }
    private stateBeforeSpecialT(c: string) {
        if (c === "i" || c === "I") {
            this._state = State.BeforeTitle1;
        } else if (c === "e" || c === "E") {
            this._state = State.BeforeTemplate1;
        } else {
            this._state = State.InTagName;
            this._index--; // Consume the token again
        }
    }
    private stateBeforeSpecialTEnd(c: string) {
        if (this.special === Special.Title && (c === "i" || c === "I")) {
            this._state = State.AfterTitle1;
        } else if (this.special === Special.Template && (c === "e" || c === "E")) {
            this._state = State.AfterTemplate1;
        } else this._state = State.Text;
    }
    private stateBeforeSpecialLast(c: string, special: Special) {
        if (c === "/" || c === ">" || whitespace(c)) {
            this.special = special;
        }
        this._state = State.InTagName;
        this._index--; // Consume the token again
    }
    private stateAfterSpecialLast(c: string, sectionStartOffset: number) {
        if (c === ">" || whitespace(c)) {
            this.special = Special.None;
            this._state = State.InClosingTagName;
            this.sectionStart = this._index - sectionStartOffset;
            this._index--; // Reconsume the token
        } else this._state = State.Text;
    }
    // For entities terminated with a semicolon
    private parseFixedEntity(
        map: Record<string, string> = this.xmlMode ? xmlMap : entityMap
    ) {
        // Offset = 1
        if (this.sectionStart + 1 < this._index) {
            const entity = this.buffer.substring(
                this.sectionStart + 1,
                this._index
            );
            if (Object.prototype.hasOwnProperty.call(map, entity)) {
                this.emitPartial(map[entity]);
                this.sectionStart = this._index + 1;
            }
        }
    }
    // Parses legacy entities (without trailing semicolon)
    private parseLegacyEntity() {
        const start = this.sectionStart + 1;
        // The max length of legacy entities is 6
        let limit = Math.min(this._index - start, 6);
        while (limit >= 2) {
            // The min length of legacy entities is 2
            const entity = this.buffer.substr(start, limit);
            if (Object.prototype.hasOwnProperty.call(legacyMap, entity)) {
                this.emitPartial((legacyMap as Record<string, string>)[entity]);
                this.sectionStart += limit + 1;
                return;
            }
            limit--;
        }
    }
    private stateInNamedEntity(c: string) {
        if (c === ";") {
            this.parseFixedEntity();
            // Retry as legacy entity if entity wasn't parsed
            if (
                this.baseState === State.Text &&
                this.sectionStart + 1 < this._index &&
                !this.xmlMode
            ) {
                this.parseLegacyEntity();
            }
            this._state = this.baseState;
        } else if ((c < "0" || c > "9") && !isASCIIAlpha(c)) {
            if (this.xmlMode || this.sectionStart + 1 === this._index) {
                // Ignore
            } else if (this.baseState !== State.Text) {
                if (c !== "=") {
                    // Parse as legacy entity, without allowing additional characters.
                    this.parseFixedEntity(legacyMap);
                }
            } else {
                this.parseLegacyEntity();
            }
            this._state = this.baseState;
            this._index--;
        }
    }
    private decodeNumericEntity(offset: number, base: number, strict: boolean) {
        const sectionStart = this.sectionStart + offset;
        if (sectionStart !== this._index) {
            // Parse entity
            const entity = this.buffer.substring(sectionStart, this._index);
            const parsed = parseInt(entity, base);
            this.emitPartial(decodeCodePoint(parsed));
            this.sectionStart = strict ? this._index + 1 : this._index;
        }
        this._state = this.baseState;
    }
    private stateInNumericEntity(c: string) {
        if (c === ";") {
            this.decodeNumericEntity(2, 10, true);
        } else if (c < "0" || c > "9") {
            if (!this.xmlMode) {
                this.decodeNumericEntity(2, 10, false);
            } else {
                this._state = this.baseState;
            }
            this._index--;
        }
    }
    private stateInHexEntity(c: string) {
        if (c === ";") {
            this.decodeNumericEntity(3, 16, true);
        } else if (
            (c < "a" || c > "f") &&
            (c < "A" || c > "F") &&
            (c < "0" || c > "9")
        ) {
            if (!this.xmlMode) {
                this.decodeNumericEntity(3, 16, false);
            } else {
                this._state = this.baseState;
            }
            this._index--;
        }
    }

    private checkForInterpolate(c: string, stateAfter: State) {
        if (c === '\\' && !this.escaping) {
            this.escaping = true;
        } else if (c === '{' && !this.escaping) {
            this.baseState = stateAfter;
            this._state = State.BeforeInterpolate;
        } else if (this.escaping) {
            this.escaping = false;
        }
    }

    private cleanup() {
        if (this.sectionStart < 0) {
            this.buffer = "";
            this.bufferOffset += this._index;
            this._index = 0;
        } else if (this.running) {
            if (this._state === State.Text) {
                if (this.sectionStart !== this._index) {
                    this.cbs.ontext(this.buffer.substr(this.sectionStart), false);
                }
                this.buffer = "";
                this.bufferOffset += this._index;
                this._index = 0;
            } else if (this.sectionStart === this._index) {
                // The section just started
                this.buffer = "";
                this.bufferOffset += this._index;
                this._index = 0;
            } else {
                // Remove everything unnecessary
                this.buffer = this.buffer.substr(this.sectionStart);
                this._index -= this.sectionStart;
                this.bufferOffset += this.sectionStart;
            }
            this.sectionStart = 0;
        }
    }

    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    private parse() {
        while (this._index < this.buffer.length && this.running) {
            const c = this.buffer.charAt(this._index);
            // console.log(`[${this._index}]`, c, this._state, '?', State.BeforeInterpolate, State.InInterpolate, State.AfterInterpolate, this.escaping)
            if (this._state === State.Text) {
                this.stateText(c);
            } else if (this._state === State.InAttributeValueDq || this._state === State.InAttributeValueDqAfterInterpolate) {
                this.stateInAttributeValueDoubleQuotes(c);
            } else if (this._state === State.InAttributeName || this._state === State.InAttributeNameAfterInterpolate) {
                this.stateInAttributeName(c);
            } else if (this._state === State.InComment) {
                this.stateInComment(c);
            } else if (this._state === State.InSpecialComment) {
                this.stateInSpecialComment(c);
            } else if (this._state === State.BeforeAttributeName) {
                this.stateBeforeAttributeName(c);
            } else if (this._state === State.InTagName) {
                this.stateInTagName(c);
            } else if (this._state === State.InClosingTagName) {
                this.stateInClosingTagName(c);
            } else if (this._state === State.BeforeTagName) {
                this.stateBeforeTagName(c);
            } else if (this._state === State.AfterAttributeName) {
                this.stateAfterAttributeName(c);
            } else if (this._state === State.InAttributeValueSq || this._state === State.InAttributeValueSqAfterInterpolate) {
                this.stateInAttributeValueSingleQuotes(c);
            } else if (this._state === State.BeforeAttributeValue) {
                this.stateBeforeAttributeValue(c);
            } else if (this._state === State.BeforeClosingTagName) {
                this.stateBeforeClosingTagName(c);
            } else if (this._state === State.AfterClosingTagName) {
                this.stateAfterClosingTagName(c);
            } else if (this._state === State.BeforeSpecialS) {
                this.stateBeforeSpecialS(c);
            } else if (this._state === State.AfterComment1) {
                this.stateAfterComment1(c);
            } else if (this._state === State.InAttributeValueNq || this._state === State.InAttributeValueNqAfterInterpolate) {
                this.stateInAttributeValueNoQuotes(c);
            } else if (this._state === State.InSelfClosingTag) {
                this.stateInSelfClosingTag(c);
            } else if (this._state === State.InDeclaration) {
                this.stateInDeclaration(c);
            } else if (this._state === State.BeforeDeclaration) {
                this.stateBeforeDeclaration(c);
            } else if (this._state === State.AfterComment2) {
                this.stateAfterComment2(c);
            } else if (this._state === State.BeforeComment) {
                this.stateBeforeComment(c);
            } else if (this._state === State.BeforeSpecialSEnd) {
                this.stateBeforeSpecialSEnd(c);
            } else if (this._state === State.BeforeSpecialTEnd) {
                this.stateBeforeSpecialTEnd(c);
            } else if (this._state === State.AfterScript1) {
                stateAfterScript1(this, c);
            } else if (this._state === State.AfterScript2) {
                stateAfterScript2(this, c);
            } else if (this._state === State.AfterScript3) {
                stateAfterScript3(this, c);
            } else if (this._state === State.BeforeScript1) {
                stateBeforeScript1(this, c);
            } else if (this._state === State.BeforeScript2) {
                stateBeforeScript2(this, c);
            } else if (this._state === State.BeforeScript3) {
                stateBeforeScript3(this, c);
            } else if (this._state === State.BeforeScript4) {
                stateBeforeScript4(this, c);
            } else if (this._state === State.BeforeScript5) {
                this.stateBeforeSpecialLast(c, Special.Script);
            } else if (this._state === State.AfterScript4) {
                stateAfterScript4(this, c);
            } else if (this._state === State.AfterScript5) {
                this.stateAfterSpecialLast(c, 6);
            } else if (this._state === State.BeforeStyle1) {
                stateBeforeStyle1(this, c);
            } else if (this._state === State.InCdata) {
                this.stateInCdata(c);
            } else if (this._state === State.BeforeStyle2) {
                stateBeforeStyle2(this, c);
            } else if (this._state === State.BeforeStyle3) {
                stateBeforeStyle3(this, c);
            } else if (this._state === State.BeforeStyle4) {
                this.stateBeforeSpecialLast(c, Special.Style);
            } else if (this._state === State.AfterStyle1) {
                stateAfterStyle1(this, c);
            } else if (this._state === State.AfterStyle2) {
                stateAfterStyle2(this, c);
            } else if (this._state === State.AfterStyle3) {
                stateAfterStyle3(this, c);
            } else if (this._state === State.AfterStyle4) {
                this.stateAfterSpecialLast(c, 5);
            } else if (this._state === State.BeforeSpecialT) {
                this.stateBeforeSpecialT(c);
            } else if (this._state === State.BeforeTitle1) {
                stateBeforeTitle1(this, c);
            } else if (this._state === State.BeforeTitle2) {
                stateBeforeTitle2(this, c);
            } else if (this._state === State.BeforeTitle3) {
                stateBeforeTitle3(this, c);
            } else if (this._state === State.BeforeTitle4) {
                this.stateBeforeSpecialLast(c, Special.Title);
            } else if (this._state === State.AfterTitle1) {
                stateAfterTitle1(this, c);
            } else if (this._state === State.AfterTitle2) {
                stateAfterTitle2(this, c);
            } else if (this._state === State.AfterTitle3) {
                stateAfterTitle3(this, c);
            } else if (this._state === State.AfterTitle4) {
                this.stateAfterSpecialLast(c, 5);
            } else if (this._state === State.BeforeTemplate1) {
                stateBeforeTemplate1(this, c);
            } else if (this._state === State.BeforeTemplate2) {
                stateBeforeTemplate2(this, c);
            } else if (this._state === State.BeforeTemplate3) {
                stateBeforeTemplate3(this, c);
            } else if (this._state === State.BeforeTemplate4) {
                stateBeforeTemplate4(this, c);
            } else if (this._state === State.BeforeTemplate5) {
                stateBeforeTemplate5(this, c);
            } else if (this._state === State.BeforeTemplate6) {
                stateBeforeTemplate6(this, c);
            } else if (this._state === State.BeforeTemplate7) {
                this.stateBeforeSpecialLast(c, Special.Template);
            } else if (this._state === State.AfterTemplate1) {
                stateAfterTemplate1(this, c);
            } else if (this._state === State.AfterTemplate2) {
                stateAfterTemplate2(this, c);
            } else if (this._state === State.AfterTemplate3) {
                stateAfterTemplate3(this, c);
            } else if (this._state === State.AfterTemplate4) {
                stateAfterTemplate4(this, c);
            } else if (this._state === State.AfterTemplate5) {
                stateAfterTemplate5(this, c);
            } else if (this._state === State.AfterTemplate6) {
                stateAfterTemplate6(this, c);
            } else if (this._state === State.AfterTemplate7) {
                this.stateAfterSpecialLast(c, 8);
            } else if (this._state === State.BeforeInterpolate) {
                this.stateBeforeInterpolate(c);
            } else if (this._state === State.InInterpolate) {
                this.stateInInterpolate(c);
            } else if (this._state === State.AfterInterpolate) {
                this.stateAfterInterpolate(c);
            } else if (this._state === State.InProcessingInstruction) {
                this.stateInProcessingInstruction(c);
            } else if (this._state === State.InNamedEntity) {
                this.stateInNamedEntity(c);
            } else if (this._state === State.BeforeCdata1) {
                stateBeforeCdata1(this, c);
            } else if (this._state === State.BeforeEntity) {
                stateBeforeEntity(this, c);
            } else if (this._state === State.BeforeCdata2) {
                stateBeforeCdata2(this, c);
            } else if (this._state === State.BeforeCdata3) {
                stateBeforeCdata3(this, c);
            } else if (this._state === State.AfterCdata1) {
                this.stateAfterCdata1(c);
            } else if (this._state === State.AfterCdata2) {
                this.stateAfterCdata2(c);
            } else if (this._state === State.BeforeCdata4) {
                stateBeforeCdata4(this, c);
            } else if (this._state === State.BeforeCdata5) {
                stateBeforeCdata5(this, c);
            } else if (this._state === State.BeforeCdata6) {
                this.stateBeforeCdata6(c);
            } else if (this._state === State.InHexEntity) {
                this.stateInHexEntity(c);
            } else if (this._state === State.InNumericEntity) {
                this.stateInNumericEntity(c);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (this._state === State.BeforeNumericEntity) {
                stateBeforeNumericEntity(this, c);
            } else {
                this.cbs.onerror(Error("unknown _state"), this._state);
            }
            this._index++;
        }
        this.cleanup();
    }

    private finish() {
        // If there is remaining data, emit it in a reasonable way
        if (this.sectionStart < this._index) {
            this.handleTrailingData();
        }
        this.cbs.onend();
    }

    private handleTrailingData() {
        const data = this.buffer.substr(this.sectionStart);
        if (
            this._state === State.InCdata ||
            this._state === State.AfterCdata1 ||
            this._state === State.AfterCdata2
        ) {
            this.cbs.oncdata(data);
        } else if (
            this._state === State.InComment ||
            this._state === State.AfterComment1 ||
            this._state === State.AfterComment2
        ) {
            this.cbs.oncomment(data);
        } else if (this._state === State.InNamedEntity && !this.xmlMode) {
            this.parseLegacyEntity();
            if (this.sectionStart < this._index) {
                this._state = this.baseState;
                this.handleTrailingData();
            }
        } else if (this._state === State.InNumericEntity && !this.xmlMode) {
            this.decodeNumericEntity(2, 10, false);
            if (this.sectionStart < this._index) {
                this._state = this.baseState;
                this.handleTrailingData();
            }
        } else if (this._state === State.InHexEntity && !this.xmlMode) {
            this.decodeNumericEntity(3, 16, false);
            if (this.sectionStart < this._index) {
                this._state = this.baseState;
                this.handleTrailingData();
            }
        } else if (
            this._state !== State.InTagName &&
            this._state !== State.BeforeAttributeName &&
            this._state !== State.BeforeAttributeValue &&
            this._state !== State.AfterAttributeName &&
            this._state !== State.InAttributeName &&
            this._state !== State.InAttributeValueSq &&
            this._state !== State.InAttributeValueDq &&
            this._state !== State.InAttributeValueNq &&
            this._state !== State.InClosingTagName
        ) {
            this.cbs.ontext(data, false);
        }
        /*
         * Else, ignore remaining data
         * TODO add a way to remove current tag
         */
    }

    private getSection(): string {
        return this.buffer.substring(this.sectionStart, this._index);
    }
    private emitToken(name: "onopentagname" | "onclosetag" | "onattribdata" | "onattribname") {
        const section = this.getSection()
        if (section.length > 0 || name !== 'onattribname') {
            this.cbs[name](this.getSection(), false);
        }
        this.sectionStart = -1;
    }
    private emitAttribData() {
        const section = this.getSection()
        if (
            section.length > 0 ||
            // Only emit empty strings if no interpolations are present
            this._state !== State.InAttributeValueDqAfterInterpolate &&
            this._state !== State.InAttributeValueSqAfterInterpolate &&
            this._state !== State.InAttributeValueNqAfterInterpolate
        ) {
            this.cbs.onattribdata(section, false)
        }
        this.sectionStart = -1;
    }
    private emitPartial(value: string) {
        if (this.baseState !== State.Text) {
            this.cbs.onattribdata(value, false); // TODO implement the new event
        } else {
            this.cbs.ontext(value, false);
        }
    }
}
