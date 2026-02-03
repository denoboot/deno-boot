import CommandLine from "./commandline.ts";
import Command from "./command.ts";

const cmd = (name: string = "") => new CommandLine(name);

export default cmd;
export { cmd, Command, CommandLine };
