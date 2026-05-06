// Map command strings to numeric IDs for compact routing.
const CommandRegistry = {
  // my_command: 0,
};

// Wrap content in the standard message envelope.
export function message(command, content = {}) {
  return {
    command,
    payload: {
      content,
      num: CommandRegistry[command] ?? -1,
    },
  };
}

// Define one creator per command and export it.
// export function myCommandMessage(param) {
//   return message('my_command', { param });
// }
