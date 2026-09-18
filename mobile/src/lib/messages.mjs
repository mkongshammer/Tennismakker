export function mergeMessages(received = [], sent = []) {
  return [...new Map([...received, ...sent].map(message => [message.id, message])).values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
