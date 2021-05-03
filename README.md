# ihtml-parser

[![NPM version](http://img.shields.io/npm/v/ihtml-parser.svg?style=flat)](https://npmjs.org/package/@lancer/ihtml-parser)

A fork of [htmlparser2](https://github.com/fb55/htmlparser2) with added interpolation syntax. Made for use with the [Lancer html framework](https://github.com/LancerStudio/lancer).

## Installation

    npm install @lancer/ihtml-parser

## Usage

`ihtml-parser` extends `htmlparser2` to support `{{}}` for interpolation. The biggest difference in usage is receiving `string | Interpolation` instead of `string` during the parsing process.

Note that `{{}}` is not arbitrary string interpolation; it can only appear as an element's attribute or within an element's text.

Here's a quick example:

```javascript
const Parser = require("@lancer/ihtml-parser");
const parser = new htmlparser2.Parser({
    onopentag(name, attributes, iAttributes) {
        /*
         * `attributes` has type { [attrName: string]: string } | null
         *
         * However, for attributes with interpolations (e.g. foo="{{bar}}" or {{foo}}="bar"),
         * a third argument is present with type (ParsedAttribute[] | null)
         *
         * where ParsedAttribute = [DynamicContent, DynamicContent]
         * where DynamicContent = Array<string | Interpolation>
         * where Interpolation = { code: string }
         *
         * (Note that Interpolation is a class)
         */
         console.log("Open tag", name, attributes);
    },
    ontext(text) {
        /*
         * Before, `text` had type string
         *
         * Now, it has type string | Interpolation
         */
        console.log("-->", text);
    },
});
parser.write(
    `Xyz <a href="{{ myLink.url }}">Go to {{myLink.text}}</ a>`
);
parser.end();
```
