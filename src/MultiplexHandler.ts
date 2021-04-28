import type { Parser, Handler, DynamicContent, ParsedAttribute, Attributes } from "./Parser";

/**
 * Calls a specific handler function for all events that are encountered.
 */
export default class MultiplexHandler implements Handler {
    /**
     * @param func The function to multiplex all events to.
     */
    constructor(
        private readonly func: (
            event: keyof Handler,
            ...args: unknown[]
        ) => void
    ) {}

    onattribute(
        name: DynamicContent,
        value: DynamicContent,
        quote: string | null | undefined
    ): void {
        this.func("onattribute", name, value, quote);
    }
    oncdatastart(): void {
        this.func("oncdatastart");
    }
    oncdataend(): void {
        this.func("oncdataend");
    }
    ontext(text: string): void {
        this.func("ontext", text);
    }
    oninterpolate(text: string): void {
        this.func("oninterpolate", text);
    }
    onprocessinginstruction(name: string, value: string): void {
        this.func("onprocessinginstruction", name, value);
    }
    oncomment(comment: string): void {
        this.func("oncomment", comment);
    }
    oncommentend(): void {
        this.func("oncommentend");
    }
    onclosetag(name: string): void {
        this.func("onclosetag", name);
    }
    onopentag(name: string, attribs: Attributes, iattribs: ParsedAttribute[]): void {
        this.func("onopentag", name, attribs, iattribs);
    }
    onopentagname(name: string): void {
        this.func("onopentagname", name);
    }
    onerror(error: Error): void {
        this.func("onerror", error);
    }
    onend(): void {
        this.func("onend");
    }
    onparserinit(parser: Parser): void {
        this.func("onparserinit", parser);
    }
    onreset(): void {
        this.func("onreset");
    }
}
