# Factorio Text Plate Generator
Interactive prompt to generate text plate blueprints for Factorio.

<br>

## Features:
- Create blueprint from file or text input
- Decode any blueprint to a JSON file from a file or text input
- Specify text plate material, size and line spacing

<br>

## Usage:
1. Install Node.js and npm
2. Clone or download and extract the repository
3. Run the command `npm i` in the project directory
4. Run `npm start` to show the interactive prompt

<br>

## Advanced usage:
- You can edit the file [`src/characters.json`](./src/characters.json) to adjust which characters in the input text are converted to which text plate variant.  
  Make sure to only add or modify the `replacements` property and leave everything else untouched.
- If you are interested in the blueprint object structure or want to extend it, check out the file [`src/types.ts`](./src/types.ts) which contains all TS types.  
- If you know TypeScript, you can create a `test.ts` file in the same directory as the [`package.json`](./package.json) file and run it with `npm run test` to write your own code to generate text plates or encode and decode any blueprint string in various ways.  
  You can also use the [VS Code debugger](https://code.visualstudio.com/docs/nodejs/nodejs-debugging) to debug your code. Select the profile `test.ts`, set breakpoints and then press F5 to start debugging your code.

<br>

<div style="text-align: center;" align="center">

Created with ❤️ by [Sv443](https://github.com/Sv443)  
Licensed under the [MIT License](./LICENSE.txt)

</div>
