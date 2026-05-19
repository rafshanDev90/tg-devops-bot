import { logger } from '../utils/logger.js';

class CommandRouter {
  constructor() {
    this.commands = new Map();
    this.subcommands = new Map();
    this.aliases = new Map();
  }

  register(name, handler, { description = '', hidden = false, adminOnly = false } = {}) {
    this.commands.set(name, { handler, description, hidden, adminOnly });
    return this;
  }

  registerSubcommand(parent, name, handler, { description = '' } = {}) {
    if (!this.subcommands.has(parent)) {
      this.subcommands.set(parent, new Map());
    }
    this.subcommands.get(parent).set(name, { handler, description });
    return this;
  }

  registerAlias(alias, target) {
    this.aliases.set(alias, target);
    return this;
  }

  getCommand(name) {
    return this.commands.get(name) || null;
  }

  getSubcommand(parent, name) {
    const parentSubs = this.subcommands.get(parent);
    return parentSubs ? parentSubs.get(name) || null : null;
  }

  getTarget(alias) {
    return this.aliases.get(alias) || null;
  }

  getAllPublic() {
    return Array.from(this.commands.entries())
      .filter(([, cmd]) => !cmd.hidden && !cmd.adminOnly)
      .map(([name, cmd]) => ({ command: name, description: cmd.description }));
  }

  getAllAdmin() {
    return Array.from(this.commands.entries())
      .filter(([, cmd]) => cmd.adminOnly)
      .map(([name, cmd]) => ({ command: name, description: cmd.description }));
  }

  getSubcommandList(parent) {
    const subs = this.subcommands.get(parent);
    if (!subs) return [];
    return Array.from(subs.entries()).map(([name, cmd]) => ({
      command: `${parent} ${name}`,
      description: cmd.description,
    }));
  }

  parseCommand(text) {
    const parts = text.trim().split(' ');
    const cmd = parts[0].replace('/', '').toLowerCase();
    const args = parts.slice(1);
    return { cmd, args, raw: text };
  }

  async execute(ctx, text) {
    const { cmd, args } = this.parseCommand(text);

    const aliasTarget = this.getTarget(cmd);
    const commandName = aliasTarget || cmd;

    const command = this.getCommand(commandName);
    if (!command) return false;

    if (command.adminOnly) {
      const { requireAdmin } = await import('../middleware/admin.js');
      try {
        await requireAdmin(ctx, () => command.handler(ctx, args));
      } catch {
        return true;
      }
      return true;
    }

    await command.handler(ctx, args);
    return true;
  }

  async executeSubcommand(ctx, parent, text) {
    const { cmd, args } = this.parseCommand(text);
    const sub = this.getSubcommand(parent, cmd);
    if (!sub) return false;

    await sub.handler(ctx, args);
    return true;
  }

  hasSubcommands(parent) {
    return this.subcommands.has(parent);
  }
}

export const commandRouter = new CommandRouter();
