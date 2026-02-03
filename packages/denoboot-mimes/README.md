# @denoboot/mimes

`@denoboot/mimes` is a lightweight TypeScript/JavaScript package providing a comprehensive mapping of file extensions to MIME types. It also includes a simple utility to look up the MIME type of a file extension.

This package is designed for use in Deno or Node.js environments, making it easy to determine the correct MIME type for files in web servers, APIs, and other applications.

---

## Features

- ✅ Provides a complete mapping of common file extensions to their corresponding MIME types.
- ✅ Simple `lookup` function to get the MIME type from a file extension.
- ✅ Fully typed with TypeScript support.
- ✅ Works in both Deno and Node.js projects.

---

## Installation

```bash
deno add jsr:@denoboot/mimes
```

### Deno

```ts
import { lookup, mimes } from "@denoboot/mimes/mod.ts";
````

### Node.js (via npm)

```bash
npm install @denoboot/mimes
```

```ts
import { lookup, mimes } from "@denoboot/mimes";
```

---

## Usage

### Lookup MIME type by extension

```ts
import { lookup } from "@denoboot/mimes";

console.log(lookup("jpg"));  // "image/jpeg"
console.log(lookup(".html")); // "text/html"
console.log(lookup("unknown")); // undefined
```

### Access the full MIME type mapping

```ts
import { mimes } from "@denoboot/mimes";

console.log(mimes["json"]); // "application/json"
console.log(mimes["mp4"]);  // "video/mp4"
```

### Custom MIME types

```ts
// replace
mimes.js = "text/javascript"; // original: "application/javascript"

// add
mimes.ts = mimes.js;
```

---

## API

### `lookup(ext: string): string | undefined`

* **Description**: Returns the MIME type corresponding to the given file extension.
* **Parameters**:

  * `ext` — The file extension (with or without leading dot, case-insensitive).
* **Returns**: The MIME type string, or `undefined` if the extension is not recognized.

### `mimes`

* **Description**: An object containing a complete mapping of file extensions to MIME types.
* **Type**: `Record<string, string>`

---

## Example

```ts
import { lookup, mimes } from "@denoboot/mimes";

// Lookup single file extensions
console.log(lookup("mp3")); // "audio/mpeg"
console.log(lookup(".pdf")); // "application/pdf"

// Iterate through all MIME types
for (const ext in mimes) {
  console.log(`${ext} -> ${mimes[ext]}`);
}
```


## License

[MIT](LICENSE)