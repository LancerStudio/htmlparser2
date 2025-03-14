import Tokenizer from "./Tokenizer";

const formTags = new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea",
]);

const pTag = new Set(["p"]);

const openImpliesClose: Record<string, Set<string>> = {
    tr: new Set(["tr", "th", "td"]),
    th: new Set(["th"]),
    td: new Set(["thead", "th", "td"]),
    body: new Set(["head", "link", "script"]),
    li: new Set(["li"]),
    p: pTag,
    h1: pTag,
    h2: pTag,
    h3: pTag,
    h4: pTag,
    h5: pTag,
    h6: pTag,
    select: formTags,
    input: formTags,
    output: formTags,
    button: formTags,
    datalist: formTags,
    textarea: formTags,
    option: new Set(["option"]),
    optgroup: new Set(["optgroup", "option"]),
    dd: new Set(["dt", "dd"]),
    dt: new Set(["dt", "dd"]),
    address: pTag,
    article: pTag,
    aside: pTag,
    blockquote: pTag,
    details: pTag,
    div: pTag,
    dl: pTag,
    fieldset: pTag,
    figcaption: pTag,
    figure: pTag,
    footer: pTag,
    form: pTag,
    header: pTag,
    hr: pTag,
    main: pTag,
    nav: pTag,
    ol: pTag,
    pre: pTag,
    section: pTag,
    table: pTag,
    ul: pTag,
    rt: new Set(["rt", "rp"]),
    rp: new Set(["rt", "rp"]),
    tbody: new Set(["thead", "tbody"]),
    tfoot: new Set(["thead", "tbody"]),
};

const voidElements = new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

const foreignContextElements = new Set(["math", "svg"]);

const htmlIntegrationElements = new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignObject",
    "desc",
    "title",
]);

export type Attributes = { [name: string]: string | true }
export type DynamicContent = Array<string | Interpolation>
export type ParsedAttribute = [DynamicContent, DynamicContent]

export interface ParserOptions {
    /**
     * Indicates whether special tags (`<script>`, `<style>`, and `<title>`) should get special treatment
     * and if "empty" tags (eg. `<br>`) can have children.  If `false`, the content of special tags
     * will be text only. For feeds and other XML content (documents that don't consist of HTML),
     * set this to `true`.
     *
     * @default false
     */
    xmlMode?: boolean;

    /**
     * Decode entities within the document.
     *
     * @default true
     */
    decodeEntities?: boolean;

    /**
     * If set to true, all tags will be lowercased.
     *
     * @default !xmlMode
     */
    lowerCaseTags?: boolean;

    /**
     * If set to `true`, all attribute names will be lowercased. This has noticeable impact on speed.
     *
     * @default !xmlMode
     */
    lowerCaseAttributeNames?: boolean;

    /**
     * If set to true, CDATA sections will be recognized as text even if the xmlMode option is not enabled.
     * NOTE: If xmlMode is set to `true` then CDATA sections will always be recognized as text.
     *
     * @default xmlMode
     */
    recognizeCDATA?: boolean;

    /**
     * If set to `true`, self-closing tags will trigger the onclosetag event even if xmlMode is not set to `true`.
     * NOTE: If xmlMode is set to `true` then self-closing tags will always be recognized.
     *
     * @default xmlMode
     */
    recognizeSelfClosing?: boolean;

    /**
     * Allows the default tokenizer to be overwritten.
     */
    Tokenizer?: typeof Tokenizer;
}

export interface Handler {
    onparserinit(parser: Parser): void;

    /**
     * Resets the handler back to starting state
     */
    onreset(): void;

    /**
     * Signals the handler that parsing is done
     */
    onend(): void;
    onerror(error: Error): void;
    onclosetag(name: string): void;
    onopentagname(name: string): void;
    /**
     *
     * @param name Name of the attribute
     * @param value Value of the attribute.
     * @param quote Quotes used around the attribute. `null` if the attribute has no quotes around the value, `undefined` if the attribute has no value.
     */
    onattribute(
        name: DynamicContent,
        value: DynamicContent,
        quote?: string | undefined | null
    ): void;
    onopentag(name: string, attribs: Attributes | null, iattribs: ParsedAttribute[] | null): void;
    ontext(data: string | Interpolation): void;
    oncomment(data: string): void;
    oncdatastart(): void;
    oncdataend(): void;
    oncommentend(): void;
    onprocessinginstruction(name: string, data: string): void;
    oninterpolate(code: string): void;
}

const reNameEnd = /\s|\//;

export class Parser {
    /** The start index of the last event. */
    public startIndex = 0;
    /** The end index of the last event. */
    public endIndex: number | null = null;

    private tagname = "";
    private attribname = [] as DynamicContent;
    private attribvalue = [] as DynamicContent;
    private attribs: Attributes | null= null;
    private iattribs: [DynamicContent, DynamicContent][] | null= null;
    private stack: string[] = [];
    private readonly foreignContext: boolean[] = [];
    private readonly cbs: Partial<Handler>;
    private readonly options: ParserOptions;
    private readonly lowerCaseTagNames: boolean;
    private readonly lowerCaseAttributeNames: boolean;
    private readonly tokenizer: Tokenizer;

    constructor(cbs: Partial<Handler> | null, options: ParserOptions = {}) {
        this.options = options;
        this.cbs = cbs ?? {};
        this.lowerCaseTagNames = options.lowerCaseTags ?? !options.xmlMode;
        this.lowerCaseAttributeNames =
            options.lowerCaseAttributeNames ?? !options.xmlMode;
        this.tokenizer = new (options.Tokenizer ?? Tokenizer)(
            this.options,
            this
        );
        this.cbs.onparserinit?.(this);
    }

    private updatePosition(initialOffset: number) {
        if (this.endIndex === null) {
            if (this.tokenizer.sectionStart <= initialOffset) {
                this.startIndex = 0;
            } else {
                this.startIndex = this.tokenizer.sectionStart - initialOffset;
            }
        } else {
            this.startIndex = this.endIndex + 1;
        }
        this.endIndex = this.tokenizer.getAbsoluteIndex();
    }

    // Tokenizer event handlers
    ontext(data: string, isInterpolate: boolean): void {
        this.updatePosition(1);
        (this.endIndex as number)--;
        this.cbs.ontext?.(isInterpolate ? new Interpolation(data) : data);
    }

    isVoidElement(name: string): boolean {
        return !this.options.xmlMode && voidElements.has(name);
    }

    onopentagname(name: string): void {
        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }
        this.tagname = name;
        if (
            !this.options.xmlMode &&
            Object.prototype.hasOwnProperty.call(openImpliesClose, name)
        ) {
            let el;
            while (
                this.stack.length > 0 &&
                openImpliesClose[name].has(
                    (el = this.stack[this.stack.length - 1])
                )
            ) {
                this.onclosetag(el);
            }
        }
        if (!this.isVoidElement(name)) {
            this.stack.push(name);
            if (foreignContextElements.has(name)) {
                this.foreignContext.push(true);
            } else if (htmlIntegrationElements.has(name)) {
                this.foreignContext.push(false);
            }
        }
        this.cbs.onopentagname?.(name);
    }

    onopentagend(): void {
        this.updatePosition(1);
        this.cbs.onopentag?.(this.tagname, this.attribs, this.iattribs);
        this.attribs = null;
        this.iattribs = null;
        if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
            this.cbs.onclosetag(this.tagname);
        }
        this.tagname = "";
    }

    onclosetag(name: string): void {
        this.updatePosition(1);
        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }
        if (
            foreignContextElements.has(name) ||
            htmlIntegrationElements.has(name)
        ) {
            this.foreignContext.pop();
        }
        if (this.stack.length && !this.isVoidElement(name)) {
            let pos = this.stack.lastIndexOf(name);
            if (pos !== -1) {
                if (this.cbs.onclosetag) {
                    pos = this.stack.length - pos;
                    while (pos--) {
                        // We know the stack has sufficient elements.
                        this.cbs.onclosetag(this.stack.pop() as string);
                    }
                } else this.stack.length = pos;
            } else if (name === "p" && !this.options.xmlMode) {
                this.onopentagname(name);
                this.closeCurrentTag();
            }
        } else if (!this.options.xmlMode && (name === "br" || name === "p")) {
            this.onopentagname(name);
            this.closeCurrentTag();
        }
    }

    onselfclosingtag(): void {
        if (
            this.options.xmlMode ||
            this.options.recognizeSelfClosing ||
            this.foreignContext[this.foreignContext.length - 1]
        ) {
            this.closeCurrentTag();
        } else {
            this.onopentagend();
        }
    }

    private closeCurrentTag() {
        const name = this.tagname;
        this.onopentagend();
        /*
         * Self-closing tags will be on the top of the stack
         * (cheaper check than in onclosetag)
         */
        if (this.stack[this.stack.length - 1] === name) {
            this.cbs.onclosetag?.(name);
            this.stack.pop();
        }
    }

    onattribname(name: string, isInterpolate: boolean): void {
        if (this.lowerCaseAttributeNames) {
            name = name.toLowerCase();
        }
        this.attribname.push(isInterpolate ? new Interpolation(name) : name);
    }

    onattribdata(value: string, isInterpolate: boolean): void {
        this.attribvalue.push(isInterpolate ? new Interpolation(value) : value);
    }

    onattribend(quote: string | undefined | null): void {
        if (this.attribvalue.length >= 2 && this.attribvalue.every(piece => typeof piece === 'string')) {
            this.attribvalue = [this.attribvalue.join('')]
        }
        this.cbs.onattribute?.(this.attribname, this.attribvalue, quote);

        const simpleName  = this.attribname[0];
        const simpleValue = this.attribvalue[0];
        if (
            this.attribname.length === 1 && typeof simpleName === 'string' &&
            this.attribvalue.length <= 1 && (typeof simpleValue === 'string' || simpleValue === undefined)
        ) {
            if (!this.attribs) {
                this.attribs = {};
            }
            if (!this.attribs.hasOwnProperty(simpleName)) {
                this.attribs[simpleName] = quote === undefined ? true : simpleValue || '';
            }
        }
        else {
            if (!this.iattribs) {
                this.iattribs = [];
            }
            const existing = this.iattribs.findIndex(kv => dcEqual(kv[0], this.attribname));
            if (existing === -1) {
                this.iattribs.push([this.attribname, this.attribvalue]);
            }
        }

        this.attribname = [];
        this.attribvalue = [];
    }

    private getInstructionName(value: string) {
        const idx = value.search(reNameEnd);
        let name = idx < 0 ? value : value.substr(0, idx);

        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }

        return name;
    }

    ondeclaration(value: string): void {
        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
        }
    }

    onprocessinginstruction(value: string): void {
        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
        }
    }

    oncomment(value: string): void {
        this.updatePosition(4);
        this.cbs.oncomment?.(value);
        this.cbs.oncommentend?.();
    }

    oncdata(value: string): void {
        this.updatePosition(1);
        if (this.options.xmlMode || this.options.recognizeCDATA) {
            this.cbs.oncdatastart?.();
            this.cbs.ontext?.(value);
            this.cbs.oncdataend?.();
        } else {
            this.oncomment(`[CDATA[${value}]]`);
        }
    }

    onerror(err: Error): void {
        this.cbs.onerror?.(err);
    }

    onend(): void {
        if (this.cbs.onclosetag) {
            for (
                let i = this.stack.length;
                i > 0;
                this.cbs.onclosetag(this.stack[--i])
            );
        }
        this.cbs.onend?.();
    }

    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */
    public reset(): void {
        this.cbs.onreset?.();
        this.tokenizer.reset();
        this.tagname = "";
        this.attribname = [];
        this.attribs = null;
        this.iattribs = null;
        this.stack = [];
        this.cbs.onparserinit?.(this);
    }

    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     *
     * @param data Document to parse.
     */
    public parseComplete(data: string): void {
        this.reset();
        this.end(data);
    }

    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     *
     * @param chunk Chunk to parse.
     */
    public write(chunk: string): void {
        this.tokenizer.write(chunk);
    }

    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     *
     * @param chunk Optional final chunk to parse.
     */
    public end(chunk?: string): void {
        this.tokenizer.end(chunk);
    }

    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */
    public pause(): void {
        this.tokenizer.pause();
    }

    /**
     * Resumes parsing after `pause` was called.
     */
    public resume(): void {
        this.tokenizer.resume();
    }

    /**
     * Alias of `write`, for backwards compatibility.
     *
     * @param chunk Chunk to parse.
     * @deprecated
     */
    public parseChunk(chunk: string): void {
        this.write(chunk);
    }
    /**
     * Alias of `end`, for backwards compatibility.
     *
     * @param chunk Optional final chunk to parse.
     * @deprecated
     */
    public done(chunk?: string): void {
        this.end(chunk);
    }
}

export class Interpolation {
    constructor(public code: string) {}
    valueOf() { return this.code }
}

function dcEqual(xs: DynamicContent, ys: DynamicContent) {
    if (xs.length !== ys.length) return false
    for (var i=0; i < xs.length; i++) {
        const x = xs[i]
        const y = ys[i] as any
        if (
            typeof x === 'string' && x !== y ||
            typeof x !== 'string' && x.code !== y.code
        ) {
            return false
        }
    }
    return true
}
