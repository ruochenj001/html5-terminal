//"use strict";

(() => {

class Executable {
	constructor(name, description = "") {
		this.name = name;
		this.desc = description;
	}

	exec(linux, args) {
		if (args.length == 2 && args[1] == "--help")
			return this.onHelp(linux);
		let pureArgs = [];
		let options = [];
		for (let i = 0; i < args.length; i++) {
			let arg = args[i];
			if (arg.startsWith("--"))
				options.push(arg.substring(2, arg.length));
			else if (arg.startsWith("-")) {
				for (let c = 1; c < arg.length; c++)
					options.push(arg.charAt(c));
			} else pureArgs.push(arg);
		}
		return this.onExec(linux, options, pureArgs);
	}

	onExec(linux, options, args) {
		let cmd = args[0];
		if (args.length == 1 && cmd.includes("=")) {
			// set environment variable
			let params = cmd.split("=");
			let key = params[0];
			let value = params[1];
			linux.env[key] = value;
			return 0;
		} else {
			// default output
			this.output(this.name + ": command not found");
			this.output("Use command 'help' for a list of available commands.");
			return 127;
		}
	}

	description() {
		let desc = this.desc;
		if (desc == null || desc.length == 0)
			// default message
			desc = "No description available for this command";
		return desc;
	}

	onHelp(linux) {
		// default output
		this.output("This command does not provide any help messages.");
		return 0;
	}

	output(msg = "", newLine = true) {
		if (newLine)
			msg += "\r\n";
		term.write(msg);
	}

	clear() {
		term.clear();
	}
}

class Help extends Executable {
	constructor() {
		super("help", "get available commands");
	}

	onExec(linux, options, args) {
		if (args.length == 1) {
			this.output("Available commands: ");
			let str = "";
			let cmds = linux.executables;
			for (let i = 0; i < cmds.length; i++) {
				let cmd = cmds[i];
				str += "\t" + cmd.name + ": " + cmd.description() + "\r\n";
			}
			this.output(str);
			this.output("Try 'help + command' for more detailed informations.");
		} else if (args.length == 2)
			getCommandByName(args[1]).onHelp(linux);
		else {
			this.output("Invalid options");
			return 1;
		}
		return 0;
	}
}

class Clear extends Executable {
	constructor() {
		super("clear", "clear terminal screen");
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output("clear: invalid option " + quote(options[i]));
			return 1;
		}
		this.clear();
		return 0;
	}
}

class Exit extends Executable {
	constructor() {
		super("exit", "exit current session");
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output("Invalid option: " + options[i]);
			return 1;
		}
		linux.term.closed = true;
		linux.term.prompt = () => {};
		this.clear();
		return 0;
	}
}

class Document extends Executable {
	constructor(name) {
		super(name);
	}

	output(str) {
		super.output(str.replace(/(\t|\n)/g, " "));
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output(args[0] + ": invalid option " + quote(options[i]));
			return 1;
		}
		let cmd = args[0];
		switch (args.length) {
			case 1:
				this.output(document.documentElement.innerHTML);
				break;
			case 2:
				let component = args[1];
				switch (component) {
					case "head":
						this.output(document.getElementsByTagName("head")[0].innerHTML);
						break;
					case "body":
						this.output(document.getElementsByTagName("body")[0].innerHTML);
						break;
					default:
						this.output(cmd + ": unknown component " + component);
						return 1;
				}
				break;
			default:
				let operation = args[1];
				let value = "";
				for (let i = 2; i < args.length; i++)
					value += args[i] + " ";
				value = value.substring(0, value.length - 1);
				switch (operation) {
					case "set-head":
						document.getElementsByTagName("head")[0].innerHTML = value;
						break;
					case "set-body":
						document.getElementsByTagName("body")[0].innerHTML = value;
						break;
					case "write":
						document.write(value);
						break;
					case "set":
						document.documentElement.innerHTML = value;
						break;
					case "append-head":
						document.getElementsByTagName("head")[0].innerHTML += value;
						break;
					case "append-body":
						document.getElementsByTagName("body")[0].innerHTML += value;
						break;
					case "append":
						document.documentElement.innerHTML += value;
						break;
					case "get-element-by-id":
					case "get-element":
						let elem = document.getElementById(value);
						if (elem == null) {
							this.output(cmd + ": cannot find element with id " + quote(value));
							return 1;
						}
						this.output(elem.innerHTML);
						break;
					case "get-element-by-class":
					case "get-element-by-class-name":
						let element = document.getElementsByClassName(value);
						if (element.length == 0) {
							this.output(cmd + ": cannot find element with class name " + quote(value));
							return 1;
						}
						this.output(element.innerHTML);
						break;
					case "get-elements-by-class":
					case "get-elements-by-class-name":
						let elements = document.getElementsByClassName(value);
						for (let i = 0; i < elements.length; i++) {
							this.output("Element " + i + ":");
							this.output(elements[i].innerHTML);
						}
						break;
					default:
						this.output(cmd + ": invalid operation " + quote(operation));
						return 1;
				}
				break;
		}
		return 0;
	}
}

class Script extends Executable {
	constructor(name) {
		super(name, "run JavaScript code");
	}

	onExec(linux, options, args) {
		let append = "body";
		let type = "text/javascript";
		let timeout = 0;
		for (let i = 0; i < options.length; i++) {
			let opt = options[i];
			if (opt == "body")
				append = "body";
			else if (opt == "head")
				append = "head";
			else if (opt.startsWith("append="))
				append = opt.substring(7);
			else if (opt.startsWith("type="))
				type = opt.substring(5);
			else if (opt.startsWith("timeout="))
				timeout = opt.substring(8);
			else {
				this.output(args[0] + ": invalid option " + quote(opt));
				return 1;
			}
		}
		let scriptStr = "";
		for (let i = 1; i < args.length; i++)
			scriptStr += args[i] + " ";
		let scriptTag = document.createElement("script");
		scriptTag.type = type;
		scriptTag.innerHTML += "\n" + scriptStr;
		let parent = document.getElementsByTagName(append)[0];
		parent.appendChild(scriptTag);
		if (timeout > 0)
			setTimeout(() => {
				parent.removeChild(scriptTag);
			}, timeout);
		return 0;
	}
}

class Brython extends Executable {
	constructor(name) {
		super(name, "switch to Brython console");
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output(args[0] + ": invalid option " + quote(options[i]));
			return 1;
		}
		if (args.length > 1) {
			this.output(args[0] + ": the operation is not supported");
			return 1;
		}
		terminal.style.display = "none";
		let brython = document.getElementById("brython");
		brython.style.display = "block";
		return 0;
	}
}

let terminal = document.getElementById("terminal");
let term = new Terminal({cursorBlink: "block"});
let fitAddon = new FitAddon.FitAddon();
let searchAddon = new SearchAddon.SearchAddon();
let webLinksAddon = new WebLinksAddon.WebLinksAddon();
let cursor = 0;
let line = "";
let entries = [];
let current = 0;
let linux = {
	executables: [
		new Brython("brython"),
		new Clear(),
		new Document("doc"),
		new Document("document"),
		new Exit(),
		new Help(),
		new Script("javascript"),
		new Script("js"),
		new Brython("python"),
		new Brython("python3"),
		new Script("script")
	],
	env: {"HOME": "/"},
	term: term
};

term.loadAddon(fitAddon);
term.loadAddon(searchAddon);
term.loadAddon(webLinksAddon);
term.setOption("theme", { background: "#000000", foreground: "#ffffff" });
term.setOption("fontSize", 16);
term.setOption("fontWeight", "normal");
term.prompt = () => { throw null; };
term._prompt = (cl = true) => {
	term.write("\x1b[2K\r");
	term.write("\033[1;33mWebShell\033[0m $ ");
	if (cl)
		line = "";
};
term.syncLine = () => {
	term._prompt(false);
	term.write(line);
	if (cursor != line.length) {
		for (let i = line.length; i > cursor; i--) {
			term.write("[D");
		}
	}
};
term.clear = () => {
	term.write("\033[2J\033[1;1H");
	term._prompt();
};

term.open(terminal);
fitAddon.fit();

function quote(str) {
	return "\'" + str + "\'";
}

function getEnv(id) {
	let env = linux.env[id];
	if (env == null)
		env = "";
	return env;
}

function parseArgs(cmd) {
	let args = [];
	let escaped = false;
	let quoted = false;
	let envVar = false;
	let str = "";

	for (let i = 0; i < cmd.length; i++) {
		let id = cmd.charCodeAt(i);
		let ch = cmd.charAt(i);

		if (quoted || id > 0x20) {
			if (escaped) {
				str += ch;
				escaped = false;
			} else switch (ch) {
				case "\\":
					escaped = true;
					break;
				case "\"":
				case "\'":
					quoted = !quoted;
					break;
				case "$":
					envVar = true;
					break;
				case "~":
					str += "~";
					break;
				default:
					str += ch;
			}
		} else {
			if (str.length > 0) {
				if (envVar)
					str = getEnv(str);
				args.push(str);
				str = "";
			} else if (envVar)
				args.push("$");

			escaped = false;
			envVar = false;
			home = false;
		}
	}

	// end of line
	if (str.length > 0) {
		if (envVar)
			str = getEnv(str);
		args.push(str);
	} else if (envVar)
		args.push("$");
	else if (quoted)
		args.push("\"");
	else if (escaped)
		args.push("\\");

	return args;
}

function getCommandByName(name) {
	let cmds = linux.executables;
	for (let i = 0; i < cmds.length; i++)
		if (cmds[i].name == name)
			return cmds[i];
	return new Executable(name);
}

function exec(args) {
	return getCommandByName(args[0]).exec(linux, args);
}

String.prototype.replaceAt = function(i, ch) {
	let append = i - this.length;
	if (append < 0)
		return this.substring(0, i) + ch + this.substring(i + 1);
	else if (append == 0)
		return this + ch;
	else {
		let str = this;
		for (let i = 0; i < append; i++)
			str += "\u0000";
		return str + ch;
	}
}

String.prototype.insert = function(i, ch) {
	let append = i - this.length;
	if (append < 0)
		return this.substring(0, i) + ch + this.substring(i);
	else if (append == 0)
		return this + ch;
	else {
		let str = this;
		for (let i = 0; i < append; i++)
			str += "\u0000";
		return str + ch;
	}
}

String.prototype.removeAt = function(i) {
	return this.slice(0, i) + this.slice(i + 1);
}

term.closed = false;
term.input = false;
term._prompt();
term.onKey((ev) => {
	if (term.closed)
		return;

	term.input = true;
	let code  = ev.domEvent.keyCode;
	let key = ev.key;

	switch(code) {
		case 13: // enter
			term.write("\r\n");
			if (line.length > 0) {
				let args = parseArgs(line);
				entries.push(line);
				current = entries.length;
				linux.env["?"] = exec(args);
				term._prompt();
			} else term._prompt();
			cursor = 0;
			break;
		case 8: // backspace
			if (line.length > 0) {
				line = line.removeAt(--cursor);
				term.syncLine();
			}
			break;
		case 35: // end
			if (cursor != line.length) {
				cursor = line.length;
				term.syncLine();
			}
			break;
		case 36: // home
			if (cursor != 0) {
				cursor = 0;
				term.syncLine();
			}
			break;
		case 37: // arrow left
			if (cursor > 0) {
				cursor--;
				term.write(key);
			}
			break;
		case 39: // arrow right
			if (cursor < line.length) {
				cursor++;
				term.write(key);
			}
			break;
		case 38: // arrow up
			if (current > 0) {
				line = entries[--current];
				cursor = line.length;
				term.syncLine();
			}
			break;
		case 40: // arrow down
			if (current < entries.length) {
				line = entries[++current];
				if (line == null)
					line = "";
				cursor = line.length;
				term.syncLine();
			}
			break;
		default:
			line = line.insert(cursor++, key);
			term.syncLine();
			break;
	}

	setTimeout(() => {term.input = false}, 15);
});

term.onData((data) => {
	if (term.closed || term.input)
		return;

	line += data;
	term.write(data);
	cursor += data.length;
});

// correct display density

function correctDisplay(obj) {
	let maxWidth = 1024;
	let maxHeight = 768;
	let minWidth = 960;
	let minHeight = 720;
	if (obj.clientWidth > maxWidth) {
		obj.width = maxWidth;
		obj.style.width = maxWidth + "px";
	}
	if (obj.clientWidth < minWidth) {
		obj.width = minWidth;
		obj.style.width = minWidth + "px";
	}
	if (obj.clientHeight > maxHeight) {
		obj.height = maxHeight;
		obj.style.height = maxHeight + "px";
	}
	if (obj.clientHeight < minHeight) {
		obj.height = minHeight;
		obj.style.height = minHeight + "px";
	}
}

let termScreen = document.getElementsByClassName("xterm-screen");
for (let i = 0; i < termScreen.length; i++)
	correctDisplay(termScreen[i]);

let canvas = document.getElementsByTagName("canvas");
for (let i = 0; i < canvas.length; i++)
	correctDisplay(canvas[i]);

})();