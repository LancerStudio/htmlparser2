import { Tokenizer } from ".";

class CallbackLogger {
    log: string[] = [];

    onattribdata(value: string, isInterpolate: boolean) {
        this.log.push(`onattribdata: '${value}'${isInterpolate ? ' true' : ''}`);
    }
    onattribend() {
        this.log.push(`onattribend`);
    }
    onattribname(name: string, isInterpolate: boolean) {
        this.log.push(`onattribname: '${name}'${isInterpolate ? ' true' : ''}`);
    }
    onattribnameend() {
    }
    oncdata(data: string) {
        this.log.push(`oncdata: '${data}'`);
    }
    onclosetag(name: string) {
        this.log.push(`onclosetag: '${name}'`);
    }
    oncomment(data: string) {
        this.log.push(`oncomment: '${data}'`);
    }
    ondeclaration(content: string) {
        this.log.push(`ondeclaration: '${content}'`);
    }
    onend() {
        this.log.push(`onend`);
    }
    onerror(error: Error, state?: unknown) {
        this.log.push(`onerror: '${error}', '${state}'`);
    }
    onopentagend() {
        this.log.push(`onopentagend`);
    }
    onopentagname(name: string) {
        this.log.push(`onopentagname: '${name}'`);
    }
    onprocessinginstruction(instruction: string) {
        this.log.push(`onprocessinginstruction: '${instruction}'`);
    }
    onselfclosingtag() {
        this.log.push(`onselfclosingtag`);
    }
    ontext(value: string, isInterpolate: boolean) {
        this.log.push(`ontext: '${value}'${isInterpolate ? ' true' : ''}`);
    }
    oninterpolate(value: string) {
        this.log.push(`oninterpolate: '${value}'`);
    }
}

describe("Tokenizer", () => {
    test("should support self-closing special tags", () => {
        const logger = new CallbackLogger();
        const tokenizer = new Tokenizer(
            {
                xmlMode: false,
                decodeEntities: false,
            },
            logger
        );

        const selfClosingScriptInput = "<script /><div></div>";
        const selfClosingScriptOutput = [
            "onopentagname: 'script'",
            "onselfclosingtag",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(selfClosingScriptInput);
        tokenizer.end();
        expect(logger.log).toEqual(selfClosingScriptOutput);
        tokenizer.reset();
        logger.log = [];

        const selfClosingStyleInput = "<style /><div></div>";
        const selfClosingStyleOutput = [
            "onopentagname: 'style'",
            "onselfclosingtag",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(selfClosingStyleInput);
        tokenizer.end();
        expect(logger.log).toEqual(selfClosingStyleOutput);
        tokenizer.reset();
        logger.log = [];

        const selfClosingTitleInput = "<title /><div></div>";
        const selfClosingTitleOutput = [
            "onopentagname: 'title'",
            "onselfclosingtag",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(selfClosingTitleInput);
        tokenizer.end();
        expect(logger.log).toEqual(selfClosingTitleOutput);
        tokenizer.reset();
        logger.log = [];

        const selfClosingTemplateInput = "<template /><div></div>";
        const selfClosingTemplateOutput = [
            "onopentagname: 'template'",
            "onselfclosingtag",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(selfClosingTemplateInput);
        tokenizer.end();
        expect(logger.log).toEqual(selfClosingTemplateOutput);
        tokenizer.reset();
        logger.log = [];
    });

    test("should support standard special tags", () => {
        const logger = new CallbackLogger();
        const tokenizer = new Tokenizer(
            {
                xmlMode: false,
                decodeEntities: false,
            },
            logger
        );

        const normalScriptInput = "<script><b></b></script><div></div>";
        const normalScriptOutput = [
            "onopentagname: 'script'",
            "onopentagend",
            "ontext: '<b>'",
            "ontext: '</b>'",
            "onclosetag: 'script'",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(normalScriptInput);
        tokenizer.end();
        expect(logger.log).toEqual(normalScriptOutput);
        tokenizer.reset();
        logger.log = [];

        const normalStyleInput = "<style><b></b></style><div></div>";
        const normalStyleOutput = [
            "onopentagname: 'style'",
            "onopentagend",
            "ontext: '<b>'",
            "ontext: '</b>'",
            "onclosetag: 'style'",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(normalStyleInput);
        tokenizer.end();
        expect(logger.log).toEqual(normalStyleOutput);
        tokenizer.reset();
        logger.log = [];

        const normalTitleInput = "<title><b></b></title><div></div>";
        const normalTitleOutput = [
            "onopentagname: 'title'",
            "onopentagend",
            "ontext: '<b>'",
            "ontext: '</b>'",
            "onclosetag: 'title'",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(normalTitleInput);
        tokenizer.end();
        expect(logger.log).toEqual(normalTitleOutput);
        tokenizer.reset();
        logger.log = [];

        const normalTemplateInput = "<template><b></b></template><div></div>";
        const normalTemplateOutput = [
            "onopentagname: 'template'",
            "onopentagend",
            "ontext: '<b>'",
            "ontext: '</b>'",
            "onclosetag: 'template'",
            "onopentagname: 'div'",
            "onopentagend",
            "onclosetag: 'div'",
            "onend",
        ];

        tokenizer.write(normalTemplateInput);
        tokenizer.end();
        expect(logger.log).toEqual(normalTemplateOutput);
        tokenizer.reset();
        logger.log = [];
    });

    test("should tokenize normal attributes", () => {
        const logger = new CallbackLogger();
        const tokenizer = new Tokenizer(
            {
                xmlMode: false,
                decodeEntities: false,
            },
            logger
        );

        const input = `<script defer src="/foo.js"></script>`

        tokenizer.write(input);
        tokenizer.end();
        expect(logger.log).toEqual([
          "onopentagname: 'script'",
          "onattribname: 'defer'",
          'onattribend',
          "onattribname: 'src'",
          "onattribdata: '/foo.js'",
          'onattribend',
          'onopentagend',
          "onclosetag: 'script'",
          'onend'
        ]);

    })

    test("should support interpolation syntax in attributes (Lancer)", () => {
        const logger = new CallbackLogger();
        const tokenizer = new Tokenizer(
            {
                xmlMode: false,
                decodeEntities: false,
            },
            logger
        );

        const input = `<div a-{{b}}-label='{{ c +1}}' lone {{d}}="e"  {{f + f }}="g{{h }}i"></div>`;

        tokenizer.write(input);
        tokenizer.end();
        expect(logger.log).toEqual([
          "onopentagname: 'div'",
          "onattribname: 'a-'",
          "onattribname: 'b' true",
          "onattribname: '-label'",
          "onattribdata: ' c +1' true",
          'onattribend',
          "onattribname: 'lone'",
          'onattribend',
          "onattribname: 'd' true",
          "onattribdata: 'e'",
          'onattribend',
          "onattribname: 'f + f ' true",
          "onattribdata: 'g'",
          "onattribdata: 'h ' true",
          "onattribdata: 'i'",
          'onattribend',
          'onopentagend',
          "onclosetag: 'div'",
          'onend'
        ]);
    })

    test("should support interpolation syntax in text (Lancer)", () => {
        const logger = new CallbackLogger();
        const tokenizer = new Tokenizer(
            {
                xmlMode: false,
                decodeEntities: false,
            },
            logger
        );

        const input = `<div>a{{ b + b }}c\\{{d}}</div>`;

        tokenizer.write(input);
        tokenizer.end();
        expect(logger.log).toEqual([
            "onopentagname: 'div'",
            'onopentagend',
            "ontext: 'a'",
            "ontext: ' b + b ' true",
            "ontext: 'c\\{{d}}'",
            "onclosetag: 'div'",
            'onend'
        ]);

    })
});
