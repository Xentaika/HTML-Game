export const socket = io({ autoConnect: false });

socket.on('connect_error', (err) => {
  console.error('Socket error:', err);
});
