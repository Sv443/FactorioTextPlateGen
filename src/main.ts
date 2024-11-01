import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import prompt from "prompts";
import appdataPath from "appdata-path";
import clipboard from "clipboardy";
import { decodeBp, encodeBp } from "./encoding.js";
import { createTextPlateBp, defaultGenerateTextPlateBpSettings, disallowedCharsRegex, GenerateTextPlateBpSettings } from "./generator.js";
import { dirExists, fileExists, pause } from "./utils.js";
import { TextPlateSize, TextDirection, TextPlateMaterial } from "./types.js";
import packageJson from "../package.json" with { type: "json" };

const { getAppDataPath } = appdataPath;

//#region types

type Settings = Required<GenerateTextPlateBpSettings>;

type Choice<TValue> = { title: string, value: TValue }

//#region consts

const callerPathRaw = process.argv.find((arg) => arg.includes("caller-path"))?.split("caller-path=")[1];
/** Path to the directory from where this script was called */
const callerPath = callerPathRaw && callerPathRaw.length > 0 ? atob(callerPathRaw) : undefined;

const argsSepIdx = process.argv.findIndex((arg) => arg.includes("--"));
const optArgs = argsSepIdx && argsSepIdx >= 0 ? process.argv.slice(argsSepIdx + 1) : [...process.argv.slice(2)];

const shortcuts = [
  {
    aliases: ["createfromfile", "createfile", "file", "f"],
    fn: showCreateFromFile,
  },
  {
    aliases: ["createfromstring", "createstring", "string", "s"],
    fn: showCreateFromString,
  },
  {
    aliases: ["decodefile", "df"],
    fn: showDecodeFile,
  },
  {
    aliases: ["decodestring", "ds"],
    fn: showDecodeString,
  },
  {
    aliases: ["settings", "configuration", "config", "cfg", "c"],
    fn: showSettingsMenu,
  }
];

const shortcutOpt = optArgs.find((arg) => arg.toLowerCase().trim() === shortcuts.flatMap((s) => s.aliases).find((s) => s === arg.toLowerCase().trim()));

const defaultSettings: Settings = {
  ...defaultGenerateTextPlateBpSettings,
};

/** Config directory path */
const projectConfigDir = getAppDataPath("factorio-text-plate-gen");
/** Settings file path inside the config dir */
const settingsFilePath = join(projectConfigDir, "settings.json");

let settings = { ...defaultSettings };

//#region misc

/** Returns the title of the choice with the provided value or falls back to the given value itself */
function getChoiceVal<TVal extends unknown>(choices: Choice<TVal>[], val: TVal) {
  return choices.find((c) => c.value === val)?.title ?? val;
}

/** Returns the path relative to the directory from where this script was called, falls back to the current working directory */
function getPathRelativeToCaller(path: string) {
  return join(callerPath ?? process.cwd(), path);
}

//#region init

async function init() {
  console.log(`\n\x1b[34mFactorio Text Plate Blueprint Generator\x1b[0m\n${packageJson.homepage}\n`);

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

  const shortcut = shortcutOpt ? shortcuts.find((s) => s.aliases.includes(shortcutOpt.toLowerCase())) : undefined;

  if(!shortcut)
    return await showMenu();

  await shortcut.fn();
}

//#region misc

/**
 * Prompts to copy the {@linkcode content} to the clipboard or write it to the file at {@linkcode defaultPath}.  
 * The {@linkcode name} is used in the prompt message.
 */
async function promptCopyOrWriteFile(content: string, name = "Blueprint", defaultPath = "output.txt") {
  const { action } = await prompt({
    name: "action",
    type: "select",
    message: `What do you want to do with the ${name.toLowerCase()}?`,
    choices: [
      { title: "Copy to clipboard", value: "copy" },
      { title: "Save to a file", value: "writeFile" },
    ],
  });
  br();

  switch(action) {
  case "copy":
    await clipboard.write(content);
    console.log(`\x1b[32m${name} successfully copied to clipboard.\x1b[0m\n`);
    break;
  default:
  case "writeFile": {
    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: `Enter the path to save the ${name.toLowerCase()} (default: ${defaultPath}):`,
    });
    br();

    if(outputPath === undefined)
      return;

    if(outputPath.length === 0)
      outputPath = defaultPath;

    await writeFile(getPathRelativeToCaller(outputPath), content, "utf8");
    console.log(`\x1b[32mBlueprint successfully saved to '${outputPath}'\x1b[0m\n`);
    break;
  }
  }

  shortcutOpt ? undefined : await pause();
}

/** Writes a single line break to the console */
function br() {
  process.stdout.write("\n");
}

//#region main menu

/** Shows the interactive main menu */
async function showMenu(): Promise<unknown | void> {
  if(!process.stdin.isTTY)
    throw new Error("This script requires a TTY stdin channel (terminal with input capability).");

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
  br();

  switch(action) {
  case "createFromFile":
    await showCreateFromFile();
    break;
  case "createFromString":
    await showCreateFromString();
    break;
  case "decodeFile":
    await showDecodeFile();
    break;
  case "decodeString":
    await showDecodeString();
    break;
  case "editSettings":
    return await showSettingsMenu();
  case "resetSettings":
    await showResetSettings();
    break;
  default:
  case "exit":
    setImmediate(() => process.exit(0));
    return;
  }
  return showMenu();
}

//#region createFromFile

/** Create text plate blueprint from a file */
async function showCreateFromFile(): Promise<void | unknown> {
  let { inputPath } = await prompt({
    name: "inputPath",
    type: "text",
    message: "Enter the path to the file containing the text (default: input.txt):",
  });
  br();

  if(inputPath === undefined)
    return shortcutOpt ? undefined : showMenu();

  if(inputPath.length === 0)
    inputPath = "input.txt";

  inputPath = getPathRelativeToCaller(inputPath);

  if(!await fileExists(inputPath)) {
    console.error("\n\x1b[31mFile not found or no permission to access it.\x1b[0m\n");
    await pause();
    return;
  }

  let input = await readFile(inputPath, "utf8");

  if(disallowedCharsRegex.exec(input)) {
    console.warn("⚠️ \x1b[33mWarning:\x1b[0m Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.");
    await pause();
    input = input.replace(disallowedCharsRegex, "");
  }

  const bp = await createTextPlateBp(input, settings);
  const encoded = await encodeBp(bp, 48);

  await promptCopyOrWriteFile(encoded);
}

//#region createFromString

/** Create text plate blueprint from a string */
async function showCreateFromString(): Promise<void | unknown> {
  let { input } = await prompt({
    name: "input",
    type: "text",
    message: "Enter the text you want to create a blueprint from (\\n for line break, Ctrl+C to cancel):",
  });
  br();

  if(!input)
    return shortcutOpt ? undefined : showMenu();;

  input = input.replace(/\\n/gu, "\n");

  if(disallowedCharsRegex.exec(input)) {
    console.warn("⚠️ \x1b[33mWarning:\x1b[0m Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.");
    await pause();
    input = input.replace(disallowedCharsRegex, "");
  }

  const bp = await createTextPlateBp(input, settings);
  const encoded = await encodeBp(bp, 48);

  await promptCopyOrWriteFile(encoded);
}

//#region decodeFile

/** Decode an arbitrary blueprint from a file */
async function showDecodeFile(): Promise<void | unknown> {
  let { inputPath } = await prompt({
    name: "inputPath",
    type: "text",
    message: "Enter the path to the file containing the blueprint string (default: input.txt):",
  });
  br();

  if(inputPath === undefined)
    return shortcutOpt ? undefined : showMenu();;

  if(!inputPath)
    inputPath = "input.txt";

  inputPath = getPathRelativeToCaller(inputPath);

  if(!await fileExists(inputPath)) {
    console.error("\n\x1b[31mFile not found or no permission to access it.\x1b[0m\n");
    await pause();
    return;
  }

  const input = await readFile(inputPath, "utf8");
  const decoded = await decodeBp(input);

  if(!decoded) {
    console.error("\n\x1b[31mFailed to decode blueprint string.\x1b[0m\n");
    await pause();
    return;
  }

  await promptCopyOrWriteFile(JSON.stringify(decoded, undefined, 2), "Decoded blueprint", "output.json");
}

//#region decodeString

/** Decode an arbitrary blueprint from a string */
async function showDecodeString(): Promise<void | unknown> {
  let { input } = await prompt({
    name: "input",
    type: "text",
    message: "Enter the blueprint string to decode:",
  });
  br();

  if(input === undefined)
    return shortcutOpt ? undefined : showMenu();

  const decoded = await decodeBp(input);

  if(!decoded) {
    console.error("\n\x1b[31mFailed to decode blueprint string.\x1b[0m\n");
    await pause();
    return;
  }

  await promptCopyOrWriteFile(JSON.stringify(decoded, undefined, 2), "Decoded blueprint", "output.json");
}

//#region settings menu

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

const boolChoices: Choice<boolean>[] = [
  { title: "Yes", value: true },
  { title: "No", value: false },
];

/** Shows the interactive settings menu */
async function showSettingsMenu(): Promise<unknown | void> {
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
      { title: `\x1b[1mPreserve line breaks:\x1b[22m ${getChoiceVal(boolChoices, settings.preserveLineBreaks)}`, value: "preserveLineBreaks" },
      { title: "\x1b[33mBack to main menu\x1b[39m", value: "back" },
      ...(shortcutOpt ? [{ title: "\x1b[31mExit\x1b[39m", value: "exit" }] : []),
    ],
  });
  br();

  switch(setting) {
  //#SECTION size
  case "size": {
    const { size } = await prompt({
      name: "size",
      type: "select",
      message: "What size should the text plates be? Ctrl+C to cancel.",
      choices: sizeChoices,
    });
    br();

    if(!size)
      return showSettingsMenu();

    settings.size = size;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
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
    br();

    if(!material)
      return showSettingsMenu();

    settings.material = material;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
    break;
  }
  //#SECTION lineSpacing
  case "lineSpacing": {
    const { lineSpacing } = await prompt({
      name: "lineSpacing",
      type: "number",
      message: "How many tiles of space should be between lines? Negative numbers allow reversing text direction vertically. Ctrl+C to cancel.",
    });
    br();

    if(!lineSpacing && lineSpacing !== 0)
      return showSettingsMenu();

    settings.lineSpacing = lineSpacing;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
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
    br();

    if(!textDirection)
      return showSettingsMenu();

    settings.textDirection = textDirection;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
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
    br();

    if(!maxLineLength)
      return showSettingsMenu();

    settings.maxLineLength = maxLineLength;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
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
    br();

    if(!bpLabel)
      return showSettingsMenu();

    settings.bpLabel = bpLabel;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
    break;
  }
  //#SECTION preserveLineBreaks
  case "preserveLineBreaks": {
    const { preserveLineBreaks } = await prompt({
      name: "preserveLineBreaks",
      type: "select",
      message: "Should the original line breaks be preserved in the input text? Ctrl+C to cancel.",
      choices: boolChoices,
    });
    br();

    if(typeof preserveLineBreaks !== "boolean")
      return showSettingsMenu();

    settings.preserveLineBreaks = preserveLineBreaks;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

    console.log("\x1b[32mSettings successfully saved.\x1b[0m\n");
    break;
  }
  //#SECTION default, back
  default:
  case "back":
    return showMenu();
  //#SECTION exit
  case "exit":
    return;
  }
  return showSettingsMenu();
}

//#region resetSettings

/** Resets the settings to the default values */
async function showResetSettings() {
  const { confirmReset } = await prompt({
    name: "confirmReset",
    type: "confirm",
    message: "Are you sure you want to reset the settings to the default values?",
  });
  br();

  if(!confirmReset)
    return;

  await writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), "utf8");
  console.log("\x1b[33mSuccessfully reset settings to the default values.\x1b[0m\n");
  await pause();
}

init();
