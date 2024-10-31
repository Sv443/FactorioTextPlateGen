import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import prompt from "prompts";
import appdataPath from "appdata-path";
import { decodeBp, encodeBp } from "./encoding.js";
import { createTextPlateBp, defaultGenerateTextPlateBpSettings, disallowedCharsRegex, GenerateTextPlateBpSettings } from "./generator.js";
import { dirExists, fileExists, pause } from "./utils.js";
import { TextPlateSize, TextDirection, TextPlateMaterial } from "./types.js";
import packageJson from "../package.json" with { type: "json" };

const { getAppDataPath } = appdataPath;

//#region init

/** Config directory path */
const projectConfigDir = getAppDataPath("factorio-text-plate-gen");
/** Settings file path inside the config dir */
const settingsFilePath = join(projectConfigDir, "settings.json");

type Settings = Required<GenerateTextPlateBpSettings>;

const defaultSettings: Settings = {
  ...defaultGenerateTextPlateBpSettings,
};

let settings = { ...defaultSettings };

async function init() {
  if(!await dirExists(projectConfigDir)) {
    try {
      await mkdir(projectConfigDir, { recursive: true });
    }
    catch(err) {
      console.warn("\n⚠️ \x1b[33mFailed to create the project config directory. Using the defaults.\x1b[0m\nPlease make sure the user has permission to create directories in the appdata path.");
    }
  }

  try {
    settings = JSON.parse(await readFile(settingsFilePath, "utf8")) as Settings;
  }
  catch(err) {
    if(!await fileExists(settingsFilePath))
      await writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), "utf8");
    else
      console.warn("\n⚠️ \x1b[33mFailed to load settings. Using the defaults.\x1b[0m");
  }

  // always keep settings file in sync with the default values (in case new props get added) and the loaded settings
  await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

  await showMenu();
}

//#region main menu

/** Shows the interactive main menu */
async function showMenu(): Promise<unknown | void> {
  if(!process.stdin.isTTY)
    throw new Error("This script requires a TTY stdin channel (terminal with input capability).");

  console.log(`\n\n\x1b[34mFactorio Text Plate Blueprint Generator\x1b[0m\n${packageJson.homepage}\n`);

  const { action } = await prompt({
    name: "action",
    type: "select",
    message: "What do you want to do?",
    choices: [
      { title: "\x1b[32mCreate\x1b[39m text plate blueprint from a file", value: "createFromFile" },
      { title: "\x1b[32mCreate\x1b[39m text plate blueprint from a string", value: "createFromString" },
      { title: "\x1b[35mDecode\x1b[39m blueprint from a file", value: "decodeFile" },
      { title: "\x1b[35mDecode\x1b[39m blueprint from a string", value: "decodeString" },
      { title: "\x1b[34mConfigure\x1b[39m the settings", value: "editSettings" },
      { title: "\x1b[33mReset\x1b[39m the settings", value: "resetSettings" },
      { title: "\x1b[31mExit\x1b[39m", value: "exit" },
    ],
  });

  switch(action) {
  //#SECTION createFromFile
  case "createFromFile": {
    let { inputPath } = await prompt({
      name: "inputPath",
      type: "text",
      message: "Enter the path to the file containing the text (default: input.txt):",
    });

    if(inputPath === undefined)
      return showMenu();

    if(inputPath.length === 0)
      inputPath = "input.txt";

    if(!await fileExists(inputPath)) {
      console.error("\n\x1b[31mFile not found or no permission to access it.\x1b[0m\n");
      await pause();
      break;
    }

    let input = await readFile(inputPath, "utf8");

    if(disallowedCharsRegex.exec(input)) {
      console.warn("⚠️ \x1b[33mWarning:\x1b[0m Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.");
      await pause();
      input = input.replace(disallowedCharsRegex, "");
    }

    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: "Enter the path to save the blueprint (default: output.txt):",
    });

    if(outputPath === undefined)
      return showMenu();

    if(outputPath.length === 0)
      outputPath = "output.txt";

    const bp = await createTextPlateBp(input, settings);
    const encoded = await encodeBp(bp, 48);

    await writeFile(outputPath, encoded, "utf8");
    console.log(`\n\x1b[32mBlueprint created and saved to '${outputPath}'\x1b[0m\n`);
    await pause();
    break;
  }
  //#SECTION createFromString
  case "createFromString": {
    let { input } = await prompt({
      name: "input",
      type: "text",
      message: "Enter the text you want to create a blueprint from (\\n for line break, Ctrl+C to cancel):",
    });

    if(!input)
      return showMenu();

    input = input.replace(/\\n/gu, "\n");

    if(disallowedCharsRegex.exec(input)) {
      console.warn("⚠️ \x1b[33mWarning:\x1b[0m Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.");
      await pause();
      input = input.replace(disallowedCharsRegex, "");
    }

    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: "Enter the path to save the blueprint (default: output.txt):",
    });

    if(outputPath === undefined)
      return showMenu();

    if(outputPath.length === 0)
      outputPath = "output.txt";

    const bp = await createTextPlateBp(input, settings);
    const encoded = await encodeBp(bp, 48);
    await writeFile(outputPath, encoded, "utf8");
    console.log(`\n\x1b[32mBlueprint created and saved to '${outputPath}'\x1b[0m\n`);
    await pause();
    break;
  }
  //#SECTION decodeFile
  case "decodeFile": {
    let { inputPath } = await prompt({
      name: "inputPath",
      type: "text",
      message: "Enter the path to the file containing the blueprint string (default: input.txt):",
    });

    if(inputPath === undefined)
      return showMenu();

    if(!inputPath)
      inputPath = "input.txt";

    if(!await fileExists(inputPath)) {
      console.error("\n\x1b[31mFile not found or no permission to access it.\x1b[0m\n");
      await pause();
      break;
    }

    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: "Enter the path to save the decoded blueprint (default: output.json):",
    });

    if(outputPath === undefined)
      return showMenu();

    if(outputPath.length === 0)
      outputPath = "output.json";

    const input = await readFile(inputPath, "utf8");
    const decoded = await decodeBp(input);

    if(!decoded) {
      console.error("\n\x1b[31mFailed to decode blueprint string.\x1b[0m\n");
      await pause();
      break;
    }

    await writeFile(outputPath, JSON.stringify(decoded, null, 2), "utf8");
    console.log(`\n\x1b[32mBlueprint decoded and saved to ${outputPath}\x1b[0m\n`);

    await pause();
    break;
  }
  //#SECTION decodeString
  case "decodeString": {
    let { input } = await prompt({
      name: "input",
      type: "text",
      message: "Enter the blueprint string to decode:",
    });

    if(input === undefined)
      return showMenu();

    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: "Enter the path to save the decoded blueprint (default: output.json):",
    });

    if(outputPath === undefined)
      return showMenu();

    if(outputPath.length === 0)
      outputPath = "output.json";

    const decoded = await decodeBp(input);

    if(!decoded) {
      console.error("\n\x1b[31mFailed to decode blueprint string.\x1b[0m\n");
      await pause();
      break;
    }

    await writeFile(outputPath, JSON.stringify(decoded, null, 2), "utf8");
    console.log(`\n\x1b[32mBlueprint decoded and saved to ${outputPath}\x1b[0m\n`);

    await pause();
    break;
  }
  //#SECTION editSettings
  case "editSettings":
    return await showSettingsMenu();
  //#SECTION resetSettings
  case "resetSettings": {
    const { confirmReset } = await prompt({
      name: "confirmReset",
      type: "confirm",
      message: "Are you sure you want to reset the settings to the default values?",
    });

    if(!confirmReset)
      break;

    await writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), "utf8");
    console.log("\n\x1b[32mSuccessfully reset settings to the default values.\x1b[0m\n");
    await pause();
    break;
  }
  //#SECTION default, exit
  default:
  case "exit":
    setImmediate(() => process.exit(0));
    return;
  }
  return showMenu();
}

//#region settings menu

type Choice<TValue> = { title: string, value: TValue }

const sizeChoices: Choice<TextPlateSize>[] = [
  { title: "Small", value: "small" },
  { title: "Large", value: "large" },
];

const textDirectionChoices: Choice<TextDirection>[] = [
  { title: "Left to right", value: "ltr" },
  { title: "Right to left", value: "rtl" },
];

const materialChoices: Choice<TextPlateMaterial>[] = [
  { title: "Concrete", value: "concrete" },
  { title: "Copper", value: "copper" },
  { title: "Glass (Stone)", value: "glass" },
  { title: "Gold (Sulfur)", value: "gold" },
  { title: "Iron", value: "iron" },
  { title: "Plastic", value: "plastic" },
  { title: "Steel", value: "steel" },
  { title: "Stone", value: "stone" },
  { title: "Uranium", value: "uranium" },
];

/** Shows the interactive settings menu */
async function showSettingsMenu(): Promise<unknown | void> {
  const getChoiceVal = (choices: Choice<string>[], val: string) => choices.find((c) => c.value === val)?.title ?? val;

  const { setting } = await prompt({
    name: "setting",
    type: "select",
    message: "What setting do you want to change?",
    choices: [
      { title: `\x1b[1mPlate size:\x1b[22m ${getChoiceVal(sizeChoices, settings.size)}`, value: "size" },
      { title: `\x1b[1mPlate material:\x1b[22m ${getChoiceVal(materialChoices, settings.material)}`, value: "material" },
      { title: `\x1b[1mLine spacing:\x1b[22m ${settings.lineSpacing}`, value: "lineSpacing" },
      { title: `\x1b[1mText direction:\x1b[22m ${getChoiceVal(textDirectionChoices, settings.textDirection)}`, value: "textDirection" },
      { title: `\x1b[1mMax line length:\x1b[22m ${settings.maxLineLength}`, value: "maxLineLength" },
      { title: `\x1b[1mBlueprint label:\x1b[22m ${settings.bpLabel}`, value: "bpLabel" },
      { title: "\x1b[31mGo back\x1b[39m", value: "back" },
    ],
  });

  switch(setting) {
  //#SECTION size
  case "size": {
    const { size } = await prompt({
      name: "size",
      type: "select",
      message: "What size should the text plates be? Ctrl+C to cancel.",
      choices: sizeChoices,
    });

    if(!size)
      return showSettingsMenu();

    settings.size = size;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION material
  case "material": {
    const { material } = await prompt({
      name: "material",
      type: "select",
      message: "What material should the text plates be made of? Ctrl+C to cancel.",
      choices: materialChoices,
    });

    if(!material)
      return showSettingsMenu();

    settings.material = material;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION lineSpacing
  case "lineSpacing": {
    const { lineSpacing } = await prompt({
      name: "lineSpacing",
      type: "number",
      message: "How many tiles of space should be between lines? Negative numbers allow reversing text direction vertically. Ctrl+C to cancel.",
    });

    if(!lineSpacing && lineSpacing !== 0)
      return showSettingsMenu();

    settings.lineSpacing = lineSpacing;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION text direction
  case "textDirection": {
    const { textDirection } = await prompt({
      name: "textDirection",
      type: "select",
      message: "How should the text be aligned horizontally? Ctrl+C to cancel.",
      choices: textDirectionChoices,
    });

    if(!textDirection)
      return showSettingsMenu();

    settings.textDirection = textDirection;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION maxLineLength
  case "maxLineLength": {
    const { maxLineLength } = await prompt({
      name: "maxLineLength",
      type: "number",
      message: "What should the maximum length of a line be? 0 for infinite. Ctrl+C to cancel.",
      min: 0,
    });

    if(!maxLineLength)
      return showSettingsMenu();

    settings.maxLineLength = maxLineLength;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION bpLabel
  case "bpLabel": {
    const { bpLabel } = await prompt({
      name: "bpLabel",
      type: "text",
      message: "What should the blueprint label be? Ctrl+C to cancel.",
      limit: 199,
    });

    if(!bpLabel)
      return showSettingsMenu();

    settings.bpLabel = bpLabel;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\n\x1b[32mSettings saved.\x1b[0m\n");
    break;
  }
  //#SECTION default, back
  default:
  case "back":
    return showMenu();
  }
  return showSettingsMenu();
}

init();
