import argparse from "@denoboot/argparse/mod.ts";
import { prompts } from "@denoboot/prompts/mod.ts";
import { colors } from "@denoboot/ansi-tools";
import { basename, join, relative, resolve } from "@denoboot/x/std/path.ts";

const {
  blue,
  blueBright,
  cyan,
  green,
  magenta,
  red,
  redBright,
  underline,
  yellow,
} = colors;

const argv = argparse(Deno.args, {
  boolean: ["help", "overwrite", "immediate", "rolldown", "interactive"],
  alias: { h: "help", t: "template", i: "immediate" },
  string: ["template"],
});
const cwd = Deno.cwd();

// prettier-ignore
const helpMessage = `\
Usage: create-boot [OPTION]... [DIRECTORY]

Create a new DenoBoot project in JavaScript or TypeScript.
When running in TTY, the CLI will start in interactive mode.

Options:
  -t, --template NAME                   use a specific template
  -i, --immediate                       install dependencies and start dev
  --interactive / --no-interactive      force interactive / non-interactive mode

Available templates:
${yellow("vanilla-ts          vanilla")}
${green("vue-ts              vue")}
${cyan("react-ts            react")}
${cyan("react-compiler-ts   react-compiler")}
${cyan("react-swc-ts        react-swc")}
${magenta("preact-ts           preact")}
${redBright("lit-ts              lit")}
${red("svelte-ts           svelte")}
${blue("solid-ts            solid")}
${blueBright("qwik-ts             qwik")}`;

type ColorFunc = (str: string | number) => string;
type Framework = {
  name: string;
  display: string;
  color: ColorFunc;
  variants: FrameworkVariant[];
};
type FrameworkVariant = {
  name: string;
  display: string;
  link?: `https://${string}`;
  color: ColorFunc;
  customCommand?: string;
};

const FRAMEWORKS: Framework[] = [
  {
    name: "vanilla",
    display: "Vanilla",
    color: yellow,
    variants: [
      {
        name: "vanilla-ts",
        display: "TypeScript",
        color: blue,
      },
      {
        name: "vanilla",
        display: "JavaScript",
        color: yellow,
      },
    ],
  },
];

const TEMPLATES = FRAMEWORKS.map((f) => f.variants.map((v) => v.name)).reduce(
  (a, b) => a.concat(b),
  [],
);

const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
};

const defaultTargetDir = "denoboot-project";

function run([command, ...args]: string[], options?: Deno.CommandOptions) {
  const { success, code, stderr } = new Deno.Command(command, {
    args,
    ...options,
  }).outputSync();
  if (!success) {
    console.error(`\n${command} ${args.join(" ")} error!`);
    console.error(stderr);
    Deno.exit(code);
  }
}

function install(root: string, agent: string) {
  if (Deno.env.get("_DENOBOOT_TEST_CLI")) {
    prompts.log.step(
      `Installing dependencies with ${agent}... (skipped in test)`,
    );
    return;
  }
  prompts.log.step(`Installing dependencies with ${agent}...`);
  run(getInstallCommand(agent), {
    cwd: root,
  });
}

function start(root: string, agent: string) {
  if (Deno.env.get("_DENOBOOT_TEST_CLI")) {
    prompts.log.step("Starting dev server... (skipped in test)");
    return;
  }
  prompts.log.step("Starting dev server...");
  run(getRunCommand(agent, "dev"), {
    cwd: root,
  });
}

async function init() {
  const argTargetDir = argv._[0] ? formatTargetDir(String(argv._[0])) : undefined;
  const argTemplate = argv.template;
  const argOverwrite = argv.overwrite;
  const argImmediate = argv.immediate;
  const argInteractive = argv.interactive;

  const help = argv.help;
  if (help) {
    console.log(helpMessage);
    return;
  }

  const interactive = argInteractive ?? Deno.stdin.isTerminal();

  function determineAgent() {
    // Detect AI agent environment for better agent experience (AX)
    // This is a placeholder - you'll need to implement the actual detection logic
    return { isAgent: false };
  }

  // Detect AI agent environment for better agent experience (AX)
  const { isAgent } = determineAgent();
  if (isAgent && interactive) {
    console.log(
      "\nTo create in one go, run: create-boot <DIRECTORY> --no-interactive --template <TEMPLATE>\n",
    );
  }

  const pkgInfo = pkgFromUserAgent(Deno.env.get("npm_config_user_agent"));

  const cancel = () => prompts.cancel("Operation cancelled");

  // 1. Get project name and target dir
  let targetDir = argTargetDir;
  if (!targetDir) {
    if (interactive) {
      const projectName = await prompts.text({
        message: "Project name:",
        defaultValue: defaultTargetDir,
        placeholder: defaultTargetDir,
        validate: (value) => {
          return !value || formatTargetDir(value).length > 0 ? undefined : "Invalid project name";
        },
      });
      if (prompts.isCancel(projectName)) return cancel();
      targetDir = formatTargetDir(projectName);
    } else {
      targetDir = defaultTargetDir;
    }
  }

  // 2. Handle directory if exist and not empty
  try {
    if (Deno.statSync(targetDir).isDirectory && !isEmpty(targetDir)) {
      let overwrite: "yes" | "no" | "ignore" | undefined = argOverwrite ? "yes" : undefined;
      if (!overwrite) {
        if (interactive) {
          const res = await prompts.select({
            message: (targetDir === "." ? "Current directory" : `Target directory "${targetDir}"`) +
              ` is not empty. Please choose how to proceed:`,
            options: [
              {
                label: "Cancel operation",
                value: "no",
              },
              {
                label: "Remove existing files and continue",
                value: "yes",
              },
              {
                label: "Ignore files and continue",
                value: "ignore",
              },
            ],
          });
          if (prompts.isCancel(res)) return cancel();
          overwrite = res;
        } else {
          overwrite = "no";
        }
      }

      switch (overwrite) {
        case "yes":
          emptyDir(targetDir);
          break;
        case "no":
          cancel();
          return;
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // noop
    } else {
      throw error;
    }
  }

  // 3. Get package name
  let packageName = basename(resolve(targetDir));
  if (!isValidPackageName(packageName)) {
    if (interactive) {
      const packageNameResult = await prompts.text({
        message: "Package name:",
        defaultValue: toValidPackageName(packageName),
        placeholder: toValidPackageName(packageName),
        validate(dir) {
          if (dir && !isValidPackageName(dir)) {
            return "Invalid package.json name";
          }
        },
      });
      if (prompts.isCancel(packageNameResult)) return cancel();
      packageName = packageNameResult;
    } else {
      packageName = toValidPackageName(packageName);
    }
  }

  // 4. Choose a framework and variant
  let template = argTemplate;
  let hasInvalidArgTemplate = false;
  if (argTemplate && !TEMPLATES.includes(argTemplate)) {
    template = undefined;
    hasInvalidArgTemplate = true;
  }
  if (!template) {
    if (interactive) {
      const framework = await prompts.select({
        message: hasInvalidArgTemplate
          ? `"${argTemplate}" isn't a valid template. Please choose from below: `
          : "Select a framework:",
        options: FRAMEWORKS.map((framework) => {
          const frameworkColor = framework.color;
          return {
            label: frameworkColor(framework.display || framework.name),
            value: framework,
          };
        }),
      });
      if (prompts.isCancel(framework)) return cancel();

      const variant = await prompts.select({
        message: "Select a variant:",
        options: framework.variants.map((variant) => {
          const command = variant.customCommand
            ? getFullCustomCommand(variant.customCommand, pkgInfo).replace(
              / TARGET_DIR$/,
              "",
            )
            : undefined;
          return {
            label: getLabel(variant),
            value: variant.name,
            hint: command,
          };
        }),
      });
      if (prompts.isCancel(variant)) return cancel();

      template = variant;
    } else {
      template = "vanilla-ts";
    }
  }

  const pkgManager = pkgInfo ? pkgInfo.name : "deno";

  const root = join(cwd, targetDir);
  // determine template
  let isReactSwc = false;
  if (template.includes("-swc")) {
    isReactSwc = true;
    template = template.replace("-swc", "");
  }
  let isReactCompiler = false;
  if (template.includes("react-compiler")) {
    isReactCompiler = true;
    template = template.replace("-compiler", "");
  }

  const { customCommand } = FRAMEWORKS.flatMap((f) => f.variants).find((v) => v.name === template) ??
    {};

  if (customCommand) {
    const fullCustomCommand = getFullCustomCommand(customCommand, pkgInfo);

    const [command, ...args] = fullCustomCommand.split(" ");
    // we replace TARGET_DIR here because targetDir may include a space
    const replacedArgs = args.map((arg) => arg.replace("TARGET_DIR", () => targetDir));
    const { code } = new Deno.Command(command, { args: replacedArgs })
      .outputSync();
    Deno.exit(code ?? 0);
  }

  // 5. Ask about immediate install and package manager
  let immediate = argImmediate;
  if (immediate === undefined) {
    if (interactive) {
      const immediateResult = await prompts.confirm({
        message: `Install with ${pkgManager} and start now?`,
      });
      if (prompts.isCancel(immediateResult)) return cancel();
      immediate = immediateResult;
    } else {
      immediate = false;
    }
  }

  // Only create directory for built-in templates, not for customCommand
  Deno.mkdirSync(root, { recursive: true });
  prompts.log.step(`Scaffolding project in ${root}...`);

  function fileURLToPath(url: string) {
    return new URL(url).pathname;
  }

  const templateDir = resolve(
    fileURLToPath(import.meta.url),
    "..",
    `template-${template}`,
  );

  const write = (file: string, content?: string) => {
    const targetPath = join(root, renameFiles[file] ?? file);
    if (content) {
      Deno.writeFileSync(targetPath, new TextEncoder().encode(content));
    } else if (file === "index.html") {
      const templatePath = join(templateDir, file);
      const templateContent = Deno.readTextFileSync(templatePath);
      const updatedContent = templateContent.replace(
        /<title>.*?<\/title>/,
        `<title>${packageName}</title>`,
      );
      Deno.writeFileSync(targetPath, new TextEncoder().encode(updatedContent));
    } else {
      copy(join(templateDir, file), targetPath);
    }
  };

  const files = Deno.readDirSync(templateDir);
  for (
    const file of Array.from(files).filter((f) => f.name !== "package.json")
  ) {
    write(file.name);
  }

  const pkg = JSON.parse(
    Deno.readTextFileSync(join(templateDir, `package.json`)),
  );

  pkg.name = packageName;

  write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  if (isReactSwc) {
    setupReactSwc(root, template.endsWith("-ts"));
  } else if (isReactCompiler) {
    setupReactCompiler(root, template.endsWith("-ts"));
  }

  if (immediate) {
    install(root, pkgManager);
    start(root, pkgManager);
  } else {
    let doneMessage = "";
    const cdProjectName = relative(cwd, root);
    doneMessage += `Done. Now run:\n`;
    if (root !== cwd) {
      doneMessage += `\n  cd ${cdProjectName.includes(" ") ? `"${cdProjectName}"` : cdProjectName}`;
    }
    doneMessage += `\n  ${getInstallCommand(pkgManager).join(" ")}`;
    doneMessage += `\n  ${getRunCommand(pkgManager, "dev").join(" ")}`;
    prompts.outro(doneMessage);
  }
}

function formatTargetDir(targetDir: string) {
  return targetDir.trim().replace(/\/+$/g, "");
}

function copy(src: string, dest: string) {
  const stat = Deno.statSync(src);
  if (stat.isDirectory) {
    copyDir(src, dest);
  } else {
    Deno.copyFileSync(src, dest);
  }
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName,
  );
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z\d\-~]+/g, "-");
}

function copyDir(srcDir: string, destDir: string) {
  Deno.mkdirSync(destDir, { recursive: true });
  for (const file of Deno.readDirSync(srcDir)) {
    const srcFile = join(srcDir, file.name);
    const destFile = join(destDir, file.name);
    copy(srcFile, destFile);
  }
}

function isEmpty(path: string) {
  const files = Array.from(Deno.readDirSync(path));
  return files.length === 0 || (files.length === 1 && files[0].name === ".git");
}

function emptyDir(dir: string) {
  if (!Deno.statSync(dir).isDirectory) {
    return;
  }
  for (const file of Deno.readDirSync(dir)) {
    if (file.name === ".git") {
      continue;
    }
    Deno.removeSync(join(dir, file.name), { recursive: true });
  }
}

interface PkgInfo {
  name: string;
  version: string;
}

function pkgFromUserAgent(userAgent: string | undefined): PkgInfo | undefined {
  if (!userAgent) return undefined;
  const pkgSpec = userAgent.split(" ")[0];
  const pkgSpecArr = pkgSpec.split("/");
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  };
}

function setupReactSwc(root: string, isTs: boolean) {
  // renovate: datasource=npm depName=@denoboot/plugin-react-swc
  const reactSwcPluginVersion = "4.2.2";

  editFile(join(root, "package.json"), (content) => {
    return content.replace(
      /"@denoboot\/plugin-react": ".+?"/,
      `"@denoboot/plugin-react-swc": "^${reactSwcPluginVersion}"`,
    );
  });
  editFile(
    join(root, `boot.config.${isTs ? "ts" : "js"}`),
    (content) => {
      return content.replace(
        "@denoboot/plugin-react",
        "@denoboot/plugin-react-swc",
      );
    },
  );
  updateReactCompilerReadme(
    root,
    "The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/denoboot/denoboot-plugin-react/issues/428) for tracking the progress.",
  );
}

function setupReactCompiler(root: string, isTs: boolean) {
  // renovate: datasource=npm depName=babel-plugin-react-compiler
  const reactCompilerPluginVersion = "1.0.0";

  editFile(join(root, "package.json"), (content) => {
    const asObject = JSON.parse(content);
    const devDepsEntries = Object.entries(asObject.devDependencies);
    devDepsEntries.push([
      "babel-plugin-react-compiler",
      `^${reactCompilerPluginVersion}`,
    ]);
    devDepsEntries.sort();
    asObject.devDependencies = Object.fromEntries(devDepsEntries);
    return JSON.stringify(asObject, null, 2) + "\n";
  });
  editFile(
    resolve(root, `boot.config.${isTs ? "ts" : "js"}`),
    (content) => {
      return content.replace(
        "  plugins: [react()],",
        `  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],`,
      );
    },
  );
  updateReactCompilerReadme(
    root,
    "The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.\n\nNote: This will impact DenoBoot dev & build performances.",
  );
}

function updateReactCompilerReadme(root: string, newBody: string) {
  editFile(join(root, `README.md`), (content) => {
    const h2Start = content.indexOf("## React Compiler");
    const bodyStart = content.indexOf("\n\n", h2Start);
    const compilerSectionEnd = content.indexOf("\n## ", bodyStart);
    if (h2Start === -1 || bodyStart === -1 || compilerSectionEnd === -1) {
      console.warn("Could not update compiler section in README.md");
      return content;
    }
    return content.replace(
      content.slice(bodyStart + 2, compilerSectionEnd - 1),
      newBody,
    );
  });
}

function editFile(file: string, callback: (content: string) => string) {
  const content = Deno.readTextFileSync(file);
  Deno.writeTextFileSync(file, callback(content));
}

function getFullCustomCommand(customCommand: string, pkgInfo?: PkgInfo) {
  const pkgManager = pkgInfo ? pkgInfo.name : "deno";
  const isYarn1 = pkgManager === "yarn" && pkgInfo?.version.startsWith("1.");

  return (
    customCommand
      .replace(/^npm create (?:-- )?/, () => {
        // `bun create` uses it's own set of templates,
        // the closest alternative is using `bun x` directly on the package
        if (pkgManager === "bun") {
          return "bun x create-";
        }
        // Deno uses `run -A npm:create-` instead of `create` or `init` to also provide needed perms
        if (pkgManager === "deno") {
          return "deno run -A npm:create-";
        }
        // pnpm doesn't support the -- syntax
        if (pkgManager === "pnpm") {
          return "pnpm create ";
        }
        // For other package managers, preserve the original format
        return customCommand.startsWith("npm create -- ") ? `${pkgManager} create -- ` : `${pkgManager} create `;
      })
      // Only Yarn 1.x doesn't support `@version` in the `create` command
      .replace("@latest", () => (isYarn1 ? "" : "@latest"))
      .replace(/^npm exec /, () => {
        // Prefer `pnpm dlx`, `yarn dlx`, or `bun x`
        if (pkgManager === "pnpm") {
          return "pnpm dlx ";
        }
        if (pkgManager === "yarn" && !isYarn1) {
          return "yarn dlx ";
        }
        if (pkgManager === "bun") {
          return "bun x ";
        }
        if (pkgManager === "deno") {
          return "deno run -A npm:";
        }
        // Use `npm exec` in all other cases,
        // including Yarn 1.x and other custom npm clients.
        return "npm exec ";
      })
  );
}

function getLabel(variant: FrameworkVariant) {
  const labelText = variant.display || variant.name;
  let label = variant.color(labelText);
  const { link } = variant;
  if (link) {
    label += ` ${underline(link)}`;
  }
  return label;
}

function getInstallCommand(agent: string) {
  if (agent === "yarn") {
    return [agent];
  }
  return [agent, "install"];
}

function getRunCommand(agent: string, script: string) {
  switch (agent) {
    case "yarn":
    case "pnpm":
    case "bun":
      return [agent, script];
    case "deno":
      return [agent, "task", script];
    default:
      return [agent, "run", script];
  }
}

init().catch((e) => {
  console.error(e);
});
