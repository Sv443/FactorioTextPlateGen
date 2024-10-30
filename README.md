# Factorio Text Plate Generator
Interactive prompt to generate text plate blueprints for Factorio.

<br>

## Features:
- Create blueprint from file or text input
- Decode any blueprint to a JSON file from a file or text input
- Specify text plate material, size, line spacing, text direction and max line length

<br>

## Setup:
1. Install Node.js and npm
2. Clone or download and extract the repository (green button at the top of the page)
3. Run the command `npm i` in the project directory (where the `package.json` file is)
4. Run `npm start` to show the interactive prompt
5. For registering the global command `factorio-text-plate-gen`, run `npm run pre-build` and `npm link` in the project directory

<br>

## Basic usage:
1. Create a file (`input.txt` by default) in the project directory and write your text in it.  
  You can use all special characters that are defined in [`src/characters.json`](./src/characters.json)
2. Run `npm start` to show the interactive prompt and select `Configure the settings` to adjust the text plate settings.
3. Go back to the main menu and select `Create text plate blueprint from a file`.
4. Press enter to use the default file `input.txt` or enter the path to your file.
5. The blueprint will be saved to a file called `output.txt` in the project directory.

<br>

## Advanced usage:
- You can edit the file [`src/characters.json`](./src/characters.json) to adjust which characters in the input text are converted to which text plate variant.  
  Make sure to only add or modify the `replacements` property and leave everything else untouched.
- If you are interested in the blueprint object structure or want to extend it, check out the file [`src/types.ts`](./src/types.ts) which contains all TS types.  
- If you know TypeScript, you can create a `test.ts` file in the same directory as the [`package.json`](./package.json) file and run it with `npm run test` to write your own code to generate text plates or encode and decode any blueprint string in various ways.  
  You can also use the [VS Code debugger](https://code.visualstudio.com/docs/nodejs/nodejs-debugging) to debug your code. Select the profile `test.ts`, set breakpoints and then press F5 to start debugging your code.

<br>

## Building:
1. Follow the steps of your system's prerequisites section on [this page](https://github.com/nodejs/node/blob/v20.x/BUILDING.md)
2. Follow the steps of the [usage section](#usage)
3. Run `npm run build` to build the executable for all platforms

<br>

<div style="text-align: center;" align="center">

Created with ❤️ by [Sv443](https://github.com/Sv443)  
Licensed under the [MIT License](./LICENSE.txt)

</div>
