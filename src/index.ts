import { access, constants as fsconstants, readFile, writeFile } from "node:fs/promises";
import prompt from "prompts";
import { decodeBp, encodeBp } from "./compression.js";
import { createTextPlateBp, defaultGenerateTextPlateBpSettings, type GenerateTextPlateBpSettings } from "./generator.js";
import { TextPlateSize, type TextDirection, type TextPlateMaterial } from "./types.js";
import packageJson from "../package.json" with { type: "json" };

//#region init

type Settings = Required<GenerateTextPlateBpSettings>;

const defaultSettings: Settings = {
  ...defaultGenerateTextPlateBpSettings,
};

let settings = { ...defaultSettings };

async function init() {
  try {
    settings = JSON.parse(await readFile(".text-plate-settings.json", "utf8")) as Settings;
  }
  catch(err) {
    if(!await exists(".text-plate-settings.json"))
      await writeFile(".text-plate-settings.json", JSON.stringify(defaultSettings, null, 2), "utf8");
    else
      console.error("\n⚠️ \x1b[33mFailed to load settings. Using the defaults.\x1b[0m\n");
  }

  await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

  console.log(`\x1b[34mFactorio Text Plate Blueprint Generator\x1b[0m\n${packageJson.homepage}\n`);
  await showMenu();
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
      { title: "Create text plate blueprint from a string", value: "createFromString" },
      { title: "Create text plate blueprint from a file", value: "createFromFile" },
      { title: "Decode blueprint string", value: "decodeString" },
      { title: "Decode blueprint file", value: "decodeFile" },
      { title: "\x1b[33mEdit settings\x1b[0m", value: "editSettings" },
      { title: "\x1b[31mExit\x1b[0m", value: "exit" },
    ],
  });

  switch(action) {
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

    const bp = createTextPlateBp(input, settings);
    const encoded = await encodeBp(bp, 48);
    await writeFile("output.txt", encoded, "utf8");
    console.log("\n\x1b[32mBlueprint created and saved to output.txt\x1b[0m\n");
    await pause();
    break;
  }
  //#SECTION createFromFile
  case "createFromFile": {
    let { file } = await prompt({
      name: "file",
      type: "text",
      message: "Enter the path to the file containing the text (default: input.txt):",
    });

    if(file === undefined)
      return showMenu();

    if(file.length === 0)
      file = "input.txt";

    if(!await exists(file)) {
      console.error("\n\x1b[31mFile not found or no permission to access it.\x1b[0m\n");
      await pause();
      break;
    }

    const input = await readFile(file, "utf8");
    const bp = createTextPlateBp(input, settings);
    const encoded = await encodeBp(bp, 48);

    await writeFile("output.txt", encoded, "utf8");
    console.log("\n\x1b[32mBlueprint created and saved to output.txt\x1b[0m\n");
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
  //#SECTION decodeFile
  case "decodeFile": {
    let { file } = await prompt({
      name: "file",
      type: "text",
      message: "Enter the path to the file containing the blueprint string (default: input.txt):",
    });

    if(file === undefined)
      return showMenu();

    if(!file)
      file = "input.txt";

    if(!await exists(file)) {
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

    const input = await readFile(file, "utf8");
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
  //#SECTION changeSettings
  case "editSettings":
    return await showSettingsMenu();
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
  { title: "Glass", value: "glass" },
  { title: "Gold", value: "gold" },
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
      { title: `Plate size: ${getChoiceVal(sizeChoices, settings.size)}`, value: "size" },
      { title: `Plate material: ${getChoiceVal(materialChoices, settings.material)}`, value: "material" },
      { title: `Line spacing: ${settings.lineSpacing}`, value: "lineSpacing" },
      { title: `Text direction: ${getChoiceVal(textDirectionChoices, settings.textDirection)}`, value: "textDirection" },
      { title: `Max line length: ${settings.maxLineLength}`, value: "maxLineLength" },
      { title: `Blueprint label: ${settings.bpLabel}`, value: "bpLabel" },
      { title: "\x1b[31mBack\x1b[0m", value: "back" },
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
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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

    if(!lineSpacing)
      return showSettingsMenu();

    settings.lineSpacing = lineSpacing;
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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
    await writeFile(".text-plate-settings.json", JSON.stringify(settings, null, 2), "utf8");

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

//#region utils

/** Shows a "Press any key to continue..." message and waits for a key press */
function pause(text?: string) {
  if(!text || typeof text !== "string")
    text = "Press any key to continue...";

  const initialRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);

  return new Promise((resolve, reject) => {
    process.stdout.write(`${text} `);
    process.stdin.resume();

    let onData = (chunk: string) => {
      if(/\u0003/gu.test(chunk)) // eslint-disable-line no-control-regex
        process.exit(0);

      process.stdout.write("\n");
      process.stdin.pause();

      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("error", onError);

      process.stdin.setRawMode(initialRaw);

      return resolve(chunk.toString());
    }

    let onError = (err: unknown) => {
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("error", onError);

      process.stdin.setRawMode(initialRaw);

      return reject(err);
    }

    process.stdin.on("data", onData);
    process.stdin.on("error", onError);
  });
}

/** Checks if a file exists */
async function exists(path: string) {
  try {
    await access(path, fsconstants.W_OK | fsconstants.R_OK);
    return true;
  }
  catch {
    return false;
  }
}

init();
