class Executable {
	constructor(name) {
		this.name = name;
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
			if (cmd.includes("/") || cmd == ".." || cmd == ".") {
				let path = absPath(linux.directory, cmd);
				switch (checkExistence(path)) {
					case "directory":
						term.write(cmd + ": Is a directory\r\n");
						return 126;
					case "file":
						term.write(cmd + ": Permission denied\r\n");
						return 126;
					default:
						term.write(cmd + ": No such file or directory\r\n");
						return 127;
				}
			} else {
				this.output(this.name + ": command not found");
				this.output("Try 'help' for a list of available command.");
				return 127;
			}
		}
	}

	onHelp(linux) {
		this.output(this.name + ": no help available");
		return 0;
	}

	output(msg, newLine = true) {
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
		super("help");
	}

	onExec(linux, options, args) {
		if (args.length == 1) {
			this.output("Available commands: ");
			let str = "\t";
			let cmds = linux.executables;
			for (let i = 0; i < cmds.length; i++)
				str += cmds[i].name + " ";
			this.output(str);
			this.output("\nTry 'help + command' for more detailed informations.");
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
		super("clear");
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output("clear: invalid option " + quote(options[i]));
			return 1;
		}
		super.clear();
		return 0;
	}
}

class Cd extends Executable {
	constructor() {
		super("cd");
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output("cd: invalid option " + options[i]);
			return 1;
		}
		if (args.length > 2) {
			this.output("cd: too many arguments");
			return 1;
		}
		let path = (args.length == 1 ? linux.env.HOME : absPath(linux.directory, args[1]));
		switch (checkExistence(path)) {
			case "file":
				this.output("cd: " + path + ": Not a directory");
				return 1;
			case "directory":
				linux.directory = path;
				break;
			default:
				this.output("cd: " + path + ": No such file or directory");
				return 1;
		}
		return 0;
	}
}

class Echo extends Executable {
	constructor() {
		super("echo");
	}

	exec(linux, args) {
		let str = "";
		for (let i = 1; i < args.length; i++)
			str += args[i] + " ";
		this.output(str);
		return 0;
	}
}

class Exit extends Executable {
	constructor() {
		super("exit");
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

class Curl extends Executable {
	constructor() {
		super("curl");
	}

	checkUrl(url) {
		try {
			return new URL(url).href;
		} catch(err) {
			return null;
		}
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output("curl: invalid option " + quote(options[i]));
			return 1;
		}
		if (args.length == 1) {
			this.output("curl: no URL specified!");
			return 1;
		}
		for (let i = 1; i < args.length; i++) {
			let url = this.checkUrl(args[i]);
			if (url == null) {
				this.output("curl: invalid URL: " + quote(args[i]));
				return 1;
			}
			let embed = document.createElement("object");
			let body = document.getElementsByTagName("body")[0];
			embed.type = "text/plain";
			embed.width = 800;
			embed.height = 600;
			embed.data = url;
			embed.onload = (e) => {
				let doc = embed.contentDocument;
				if (doc == null)
					doc = embed.contentWindow.document;
				this.output(doc.documentElement.innerHTML);
				body.removeChild(embed);
			};
			body.appendChild(embed);
		}
		return 0;
	}
}

class Mkdir extends Executable {
	constructor() {
		super("mkdir");
	}

	onExec(linux, options, args) {
		if (args.length == 1) {
			this.output("mkdir: missing operand");
			return 1;
		}
		let parent = false;
		let verbose = false;
		for (let i = 0; i < options.length; i++) {
			switch(options[i]) {
				case "p":
				case "parent":
					parent = true;
					break;
				case "v":
				case "verbose":
					verbose = true;
					break;
				default:
					this.output("mkdir: invalid option " + quote(options[i]));
					return 1;
			}
		}
		let code = 0;
		for (let i = 1; i < args.length; i++) {
			let obj = args[i];
			let path = absPath(linux.directory, obj);
			if (checkExistence(path) != "not-found") {
				this.output("mkdir: cannot create directory " + quote(obj) + ": File exists");
				code = 1;
			} else {
				if (parent) {
					// create parent directories
					for (let parent = parentPath(path); parent != "/"; parent = parentPath(parent)) {
						switch (checkExistence(parent)) {
							case "file":
								this.output("mkdir: cannot create directory " + quote(parent) + ": Not a directory");
								code = 1;
								break;
							case "not-found":
								linux.directories.push(parent); // create directory
								if (verbose)
									this.output("mkdir: created directory " + quote(parent));
								break;
						}
					}
					// create target directory
					linux.directories.push(path);
					if (verbose)
						this.output("mkdir: created directory " + quote(obj));
				} else {
					let parent = parentPath(path);
					switch (checkExistence(parent)) {
						case "file":
							this.output("mkdir: cannot create directory " + quote(obj) + ": Not a directory");
							code = 1;
							break;
						case "not-found":
							this.output("mkdir: cannot create directory " + quote(obj) + ": No such file or directory");
							code = 1;
							break;
						default:
							linux.directories.push(path);
							if (verbose)
								this.output("mkdir: created directory " + quote(obj));
							break;
					}
				}
			}
		}
		return code;
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
		switch (args.length) {
			case 1:
				this.output(document.documentElement.innerHTML);
				break;
			case 2:
				switch (args[1]) {
					case "head":
						this.output(document.getElementsByTagName("head")[0].innerHTML);
						break;
					case "body":
						this.output(document.getElementsByTagName("body")[0].innerHTML);
						break;
					default:
						this.output(args[0] + ": unknown component " + quote(args[1]));
						return 1;
				}
				break;
			case 3:
				switch (args[1]) {
					case "set-head":
						document.getElementsByTagName("head")[0].innerHTML = args[2];
						break;
					case "set-body":
						document.getElementsByTagName("body")[0].innerHTML = args[2];
						break;
					case "set":
						document.documentElement.innerHTML = args[2];
						break;
					case "append-head":
						document.getElementsByTagName("head")[0].innerHTML += args[2];
						break;
					case "append-body":
						document.getElementsByTagName("body")[0].innerHTML += args[2];
						break;
					case "append":
						document.documentElement.innerHTML += args[2];
						break;
					case "get-element-by-id":
					case "get-element":
						let elem = document.getElementById(args[2]);
						if (elem == null) {
							this.output(args[0] + ": cannot find element with id " + quote(args[2]));
							return 1;
						}
						this.output(elem.innerHTML);
						break;
					case "get-element-by-class":
					case "get-element-by-class-name":
						let element = document.getElementsByClassName(args[2]);
						if (element.length == 0) {
							this.output(args[0] + ": cannot find element with class name " + quote(args[2]));
							return 1;
						}
						this.output(element.innerHTML);
						break;
					case "get-elements-by-class":
					case "get-elements-by-class-name":
						let elements = document.getElementsByClassName(args[2]);
						for (let i = 0; i < elements.length; i++) {
							this.output("Element " + i + ":");
							this.output(elements[i].innerHTML);
						}
						break;
					default:
						this.output(args[0] + ": invalid operation " + quote(args[1]));
						return 1;
				}
				break;
			default:
				this.output(args[0] + ": invalid arguments");
				return 1;
		}
		return 0;
	}
}

class Script extends Executable {
	constructor(name) {
		super(name);
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
		super(name);
	}

	onExec(linux, options, args) {
		for (let i = 0; i < options.length; i++) {
			this.output(args[0] + ": invalid option " + quote(options[i]));
			return 1;
		}
		if (args.length > 1) {
			this.output(args[0] + ": load from local file is not currently supported");
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
	files: [],
	directories: [ "/" ],
	directory: "/",
	executables: [
		new Brython("brython"),
		new Cd(),
		new Clear(),
		new Curl(),
		new Document("doc"),
		new Document("document"),
		new Echo(),
		new Exit(),
		new Help(),
		new Script("javascript"),
		new Script("js"),
		new Mkdir(),
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
	term.write(linux.directory + " $ ");
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

function isAbsolute(path) {
	return path.startsWith("/") &&
		!path.includes("/./") &&
		!path.includes("/../") &&
		!path.endsWith(".") &&
		!path.endsWith("..")
}

function absPath(dir, change) {
	if (isAbsolute(change))
		return change;
	
	if (!dir.startsWith("/"))
		dir = "/" + dir;
	if (!dir.endsWith("/"))
		dir += "/";
	
	return new URL("https://example.com" + dir + change).pathname;
}

function parentPath(path) {
	return absPath(path, "..");
}

function checkExistence(path) {
	for (let i = 0; i < linux.files.length; i++)
		if (path == linux.files[i])
			return "file";
	for (let i = 0; i < linux.directories.length; i++)
		if (path == linux.directories[i])
			return "directory";
	return "not-found";
}

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
	let home = false;
	let str = "";
	for (let i = 0; i < cmd.length; i++) {
		let id = cmd.charCodeAt(i);
		let ch = cmd.charAt(i);
		if (quoted || id > 0x20) {
			if (home) {
				str += "~";
				home = false;
			}
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
					if (!quoted && !home)
						home = true;
					else str += "~";
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
			else if (home)
				args.push(linux.env.HOME);
			escaped = false;
			envVar = false;
			home = false;
		}
	}
	if (str.length > 0) {
		if (envVar)
			str = getEnv(str);
		args.push(str);
	} else if (envVar)
		args.push("$");
	else if (home)
		args.push(linux.env.HOME);
	return {
		args: args,
		escaped: escaped,
		quoted: quoted
	};
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

// check window
if (window != window.top) {
	let allowEmbed = window.allowEmbed;
	if (!allowEmbed)
		term.write("\033[1;31mError: Invalid session (embed not allowed)\033[0m\r\n");
}
if (window.innerWidth < 1024 || window.innerHeight < 768) {
	term.write("\033[1;33mWarning: Your screen resolution is not supported, please change your screen resolution or use a different device.\033[0m\r\n");
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
				if (args.quoted || args.escaped)
					line += "\r\n";
				else {
					entries.push(line);
					current = entries.length;
					linux.env["?"] = exec(args.args);
					term._prompt();
				}
			} else term._prompt();
			cursor = 0;
			break;
		case 8: // backspace
			if (line.length > 0) {
				line = line.removeAt(--cursor);
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
