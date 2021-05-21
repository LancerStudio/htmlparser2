import { Parser, Tokenizer } from ".";
import { Attributes, DynamicContent, Interpolation, ParsedAttribute } from "./Parser";

describe("API", () => {
    test("should work without callbacks", () => {
        const cbs: Record<string, (t?: string) => void> = {};
        const p = new Parser(cbs, {
            xmlMode: true,
            lowerCaseAttributeNames: true,
        });

        p.end("<a foo><bar></a><!-- --><![CDATA[]]]><?foo?><!bar><boo/>boohay");
        p.write("foo");

        // Check for an error
        p.end();
        let err = false;
        cbs.onerror = () => (err = true);
        p.write("foo");
        expect(err).toBeTruthy();
        err = false;
        p.end();
        expect(err).toBeTruthy();

        p.reset();

        // Remove method
        cbs.onopentag = () => {
            /* Ignore */
        };
        p.write("<a foo");
        delete cbs.onopentag;
        p.write(">");

        // Pause/resume
        let processed = false;
        cbs.ontext = (t) => {
            expect(t).toBe("foo");
            processed = true;
        };
        p.pause();
        p.write("foo");
        expect(processed).toBeFalsy();
        p.resume();
        expect(processed).toBeTruthy();
        processed = false;
        p.pause();
        expect(processed).toBeFalsy();
        p.resume();
        expect(processed).toBeFalsy();
        p.pause();
        p.end("foo");
        expect(processed).toBeFalsy();
        p.resume();
        expect(processed).toBeTruthy();
    });

    test("should back out of numeric entities (#125)", () => {
        let finished = false;
        let text = "";
        const p = new Parser({
            ontext(data) {
                text += data;
            },
            onend() {
                finished = true;
            },
        });

        p.end("id=770&#anchor");

        expect(finished).toBeTruthy();
        expect(text).toBe("id=770&#anchor");

        p.reset();
        text = "";
        finished = false;

        p.end("0&#xn");

        expect(finished).toBeTruthy();
        expect(text).toBe("0&#xn");
    });

    test("should update the position", () => {
        const p = new Parser(null);

        p.write("foo");

        expect(p.startIndex).toBe(0);
        expect(p.endIndex).toBe(2);

        p.write("<bar>");

        expect(p.startIndex).toBe(3);
        expect(p.endIndex).toBe(7);
    });

    test("should update the position when a single tag is spread across multiple chunks", () => {
        const p = new Parser(null);

        p.write("<div ");
        p.write("foo=bar>");

        expect(p.startIndex).toBe(0);
        expect(p.endIndex).toBe(12);
    });

    test("should parse <__proto__> (#387)", () => {
        const p = new Parser(null);

        // Should not throw
        p.write("<__proto__>");
    });

    test("should support custom tokenizer", () => {
        class CustomTokenizer extends Tokenizer {}

        const p = new Parser(
            {
                onparserinit(parser: Parser) {
                    // @ts-expect-error Accessing private tokenizer here
                    expect(parser.tokenizer).toBeInstanceOf(CustomTokenizer);
                },
            },
            { Tokenizer: CustomTokenizer }
        );
        p.end();
    });

    test("should parse interpolated attributes (Lancer)", () => {
        let finished = false;
        let name = '';
        let attrs = {} as Attributes;
        let iattrs = [] as ParsedAttribute[]
        const p = new Parser({
            onopentag(_name, _attrs, _iattrs) {
                name = _name;
                attrs = _attrs as any;
                iattrs = _iattrs as any;
            },
            onend() {
                finished = true;
            },
        });

        p.end(`<div a="10" b="{{20}}" c="x{{ 3 + 0 }}y" {{d}} {{e + e }}="40" f="50" ></div>`);

        expect(finished).toBe(true);
        expect(name).toBe('div');
        expect(attrs).toEqual({ a: '10', f: '50' });

        expect(iattrs).toHaveLength(4);
        expect(iattrs[0]).toEqual([['b'], [new Interpolation('20')]]);
        expect(iattrs[1]).toEqual([['c'], ['x', new Interpolation(' 3 + 0 '), 'y']]);
        expect(iattrs[2]).toEqual([[new Interpolation('d')], []]);
        expect(iattrs[3]).toEqual([[new Interpolation('e + e ')], ['40']]);
    });

    test("should parse interpolated text (Lancer)", () => {
        let finished = false;
        let text = [] as DynamicContent;
        const p = new Parser({
            ontext(data) {
                text.push(data);
            },
            onend() {
                finished = true;
            },
        });

        p.end(`<div>a {{ b + 1}} c </div>`);

        expect(finished).toBe(true);
        expect(text).toEqual(['a ', new Interpolation(' b + 1'), ' c '])
    });

    test("should parse complex attributes", () => {
        let finished = false;
        let attrs = {} as Attributes;
        let iattrs = [] as ParsedAttribute[]
        const p = new Parser({
            onopentag(_name, _attrs, _iattrs) {
                attrs = _attrs as any;
                iattrs = _iattrs as any;
            },
            onend() {
                finished = true;
            },
        });

        p.end(`<p args="{ a: one.two, b: three.get(\`four\${five}\`) }"></p>`);

        expect(finished).toBe(true);
        expect(attrs).toEqual({ args: "{ a: one.two, b: three.get(`four${five}`) }" })
        expect(iattrs).toEqual(null)
    });
});
