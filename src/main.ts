import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import prompt from "prompts";
import appdataPath from "appdata-path";
import clipboard from "clipboardy";
import k from "kleur";
import { decodeBp, encodeBp } from "./encoding.js";
import { createTextPlateBp, defaultGenerateTextPlateBpSettings, disallowedCharsRegex, GenerateTextPlateBpSettings } from "./generator.js";
import { dirExists, fileReadable, pause, schedExit } from "./utils.js";
import { TextPlateSize, TextDirection, TextPlateMaterial } from "./types.js";
import packageJson from "../package.json" with { type: "json" };

const { getAppDataPath } = appdataPath;

//#region types

type Settings = Required<GenerateTextPlateBpSettings>;

type Choice<TValue> = { title: string, value: TValue }

//#region consts

const callerPathRaw = process.argv.find((arg) => arg.includes("caller-path"))?.split("caller-path=")[1];
/** Path to the directory from where this program was called */
const callerPath = callerPathRaw && callerPathRaw.length > 0 ? decodeURIComponent(atob(callerPathRaw)) : undefined;

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
const projectConfigDir = resolve(getAppDataPath("factorio-text-plate-gen"));
/** Settings file path inside the config dir */
const settingsFilePath = join(projectConfigDir, "settings.json");

let settings = { ...defaultSettings };

//#region misc

/** Returns the title of the choice with the provided value or falls back to the given value itself */
function getChoiceVal<TVal extends unknown>(choices: Choice<TVal>[], val: TVal) {
  return choices.find((c) => c.value === val)?.title ?? val;
}

/** Returns the path relative to the directory from where this program was called, falls back to the current working directory */
function getPathRelativeToCaller(path: string) {
  return join(callerPath ?? process.cwd(), path);
}

//#region init

async function init(): Promise<unknown | void> {
  console.log(`\n${k.blue("Factorio Text Plate Blueprint Generator")}\n${packageJson.homepage}\n`);

  if(!await dirExists(projectConfigDir)) {
    try {
      await mkdir(projectConfigDir, { recursive: true });
    }
    catch(err) {
      console.warn(`\n⚠️ ${k.yellow(`Failed to create the project config directory at '${projectConfigDir}'.\nUsing the default values instead.`)}\nPlease make sure the user you're running this as has permission to create that directory.`);
      await pause();
    }
  }

  try {
    settings = JSON.parse(await readFile(settingsFilePath, "utf8")) as Settings;
  }
  catch(err) {
    if(!await fileReadable(settingsFilePath))
      await writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), "utf8");
    else {
      console.warn(`\n⚠️ ${k.yellow(`Failed to load settings from the file at '${settingsFilePath}'.\nUsing the default values instead.`)}`);
      await pause();
    }
  }

  // always keep settings file in sync with the default values (in case new props get added) and the loaded settings
  await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");

  const shortcut = shortcutOpt ? shortcuts.find((s) => s.aliases.includes(shortcutOpt.toLowerCase())) : undefined;

  if(shortcut)
    return await shortcut.fn();

  return await showMenu();
}

//#region misc prompts

/**
 * Prompts to copy the {@linkcode content} to the clipboard or write it to the file at the prompted path or {@linkcode defaultPath}.  
 * The {@linkcode uppercaseName} is used in the prompt message.
 */
async function promptCopyOrWriteFile(content: string, uppercaseName = "Blueprint", defaultPath = "output.txt"): Promise<void> {
  const { action } = await prompt({
    name: "action",
    type: "select",
    message: `What do you want to do with the ${uppercaseName.toLowerCase()}?`,
    choices: [
      { title: "Copy to clipboard", value: "copy" },
      { title: "Save to a file", value: "writeFile" },
    ],
  });
  br();

  switch(action) {
  case "copy":
    await clipboard.write(content);
    console.log(k.green(`${uppercaseName} successfully copied to clipboard.\n`));
    break;
  default:
  case "writeFile": {
    let { outputPath } = await prompt({
      name: "outputPath",
      type: "text",
      message: `Enter the path to save the ${uppercaseName.toLowerCase()} (default: ${defaultPath}):`,
    });
    br();

    if(outputPath === undefined)
      return;

    if(outputPath.length === 0)
      outputPath = defaultPath;

    await writeFile(getPathRelativeToCaller(outputPath), content, "utf8");
    console.log(k.green(`Blueprint successfully saved to '${outputPath}'\n`));
    break;
  }
  }

  shortcutOpt ? undefined : await pause();
}

/** Prompts for the path to an input file */
async function promptInputFilePath(inputFileType: string, defaultPath = "input.txt"): Promise<string | void> {
  let { inputPath } = await prompt({
    name: "inputPath",
    type: "text",
    message: `Enter the path to the file containing the ${inputFileType} (default: ${defaultPath}):`,
  });
  br();

  if(inputPath === undefined) {
    !shortcutOpt && showMenu();
    return;
  }

  if(inputPath.length === 0)
    inputPath = defaultPath;

  inputPath = getPathRelativeToCaller(inputPath);

  if(!await fileReadable(inputPath)) {
    console.error(k.red("\nFile not found or no permission to access it.\n"));
    await pause();
    return;
  }

  return inputPath;
}

/** Writes a single line break to the console */
function br() {
  process.stdout.write("\n");
}

//#region main menu

/** Shows the interactive main menu */
async function showMenu(): Promise<unknown | void> {
  if(!process.stdin.isTTY) {
    console.error(`${k.red("No input stream available.")}\nThis program requires a TTY stdin channel (a terminal with input capability).\nPlease run the program directly in a terminal and not through a pipe, file redirection, process manager or similar.`);
    return schedExit(1);
  }

  const { action } = await prompt({
    name: "action",
    type: "select",
    message: "What do you want to do?",
    choices: [
      { title: `${k.green("Create")} text plate blueprint from a file`, value: "createFromFile" },
      { title: `${k.green("Create")} text plate blueprint from a string`, value: "createFromString" },
      { title: `${k.magenta("Decode")} blueprint from a file`, value: "decodeFile" },
      { title: `${k.magenta("Decode")} blueprint from a string`, value: "decodeString" },
      { title: `${k.blue("Configure")} the settings`, value: "editSettings" },
      { title: `${k.yellow("Reset")} the settings`, value: "resetSettings" },
      { title: k.red("Exit"), value: "exit" },
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
    return schedExit(1);
  }
  return showMenu();
}

//#region createFromFile

/** Create text plate blueprint from a file */
async function showCreateFromFile(): Promise<void | unknown> {
  const inputPath = await promptInputFilePath("text");

  if(!inputPath) {
    !shortcutOpt && showMenu();
    return;
  }

  let input = await readFile(inputPath, "utf8");

  if(disallowedCharsRegex.exec(input)) {
    console.warn(`${k.yellow("⚠️ Warning:")} Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.`);
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
    console.warn(`${k.yellow("⚠️ Warning:")} Some characters in the input text are not supported and will be removed.\nCheck the file 'src/characters.json' for supported characters.`);
    await pause();
    input = input.replace(disallowedCharsRegex, "");
  }

  const bp = await createTextPlateBp(input, settings);
  const encoded = await encodeBp(bp, 48);

  await promptCopyOrWriteFile(encoded);
}

//#region decodeFile

/** Error handling for blueprint decoding */
async function decodingErr(err?: unknown) {
  const errInst = err instanceof Error ? err : undefined;

  console.error(k.red("\nEncountered error while decoding blueprint string:"));
  if(errInst)
    console.error(errInst, "\n");
  else
    console.error("\n");

  await pause();
}

/** Decode an arbitrary blueprint from a file */
async function showDecodeFile(): Promise<void | unknown> {
  try {
    const inputPath = await promptInputFilePath("blueprint string");

    if(!inputPath) {
      !shortcutOpt && showMenu();
      return;
    }

    const input = await readFile(inputPath, "utf8");
    const decoded = await decodeBp(input);

    if(!decoded)
      return await decodingErr();

    await promptCopyOrWriteFile(JSON.stringify(decoded, undefined, 2), "Decoded blueprint", "output.json");
  }
  catch(err) {
    return await decodingErr(err);
  }
}

//#region decodeString

/** Decode an arbitrary blueprint from a string */
async function showDecodeString(): Promise<void | unknown> {
  try {
    let { input } = await prompt({
      name: "input",
      type: "text",
      message: "Enter the blueprint string to decode:",
    });
    br();

    if(input === undefined)
      return shortcutOpt ? undefined : showMenu();

    const decoded = await decodeBp(input);

    if(!decoded)
      return await decodingErr();

    await promptCopyOrWriteFile(JSON.stringify(decoded, undefined, 2), "Decoded blueprint", "output.json");
  }
  catch(err) {
    return await decodingErr(err);
  }
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
      { title: `${k.bold("Plate size:")} ${getChoiceVal(sizeChoices, settings.size)}`, value: "size" },
      { title: `${k.bold("Plate material:")} ${getChoiceVal(materialChoices, settings.material)}`, value: "material" },
      { title: `${k.bold("Line spacing:")} ${settings.lineSpacing}`, value: "lineSpacing" },
      { title: `${k.bold("Text direction:")} ${getChoiceVal(textDirectionChoices, settings.textDirection)}`, value: "textDirection" },
      { title: `${k.bold("Max line length:")} ${settings.maxLineLength}`, value: "maxLineLength" },
      { title: `${k.bold("Blueprint label:")} ${settings.bpLabel}`, value: "bpLabel" },
      { title: `${k.bold("Preserve line breaks:")} ${getChoiceVal(boolChoices, settings.preserveLineBreaks)}`, value: "preserveLineBreaks" },
      { title: k.yellow("Back to main menu"), value: "back" },
      ...(shortcutOpt ? [{ title: k.red("Exit"), value: "exit" }] : []),
    ],
  });
  br();

  const saveNewValue = async <TSettKey extends keyof Settings>(name: TSettKey, newValue: Settings[TSettKey]) => {
    settings[name] = newValue;
    await writeFile(settingsFilePath, JSON.stringify(settings, null, 2), "utf8");
    console.log(k.green("Settings successfully saved.\n"));
  }

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

    await saveNewValue("size", size);
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

    await saveNewValue("material", material);
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

    await saveNewValue("lineSpacing", lineSpacing);
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

    await saveNewValue("textDirection", textDirection);
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

    await saveNewValue("maxLineLength", maxLineLength);
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

    await saveNewValue("bpLabel", bpLabel);
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

    await saveNewValue("preserveLineBreaks", preserveLineBreaks);
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
  console.log(k.yellow("Successfully reset settings to the default values.\n"));
  await pause();
}

init();
