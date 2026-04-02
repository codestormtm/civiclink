const ROLES = require("../constants/roles");

const ROOM_ADMINS = "role:admins";
const ROOM_SYSTEM_ADMINS = "role:system_admins";

function userRoom(userId) {
  return `user:${userId}`;
}

function departmentRoom(departmentId) {
  return `department:${departmentId}`;
}

function attachSocketRooms(socket, user) {
  if (!user?.id) {
    return;
  }

  socket.join(userRoom(user.id));

  if (user.department_id) {
    socket.join(departmentRoom(user.department_id));
  }

  if (user.role === ROLES.SYSTEM_ADMIN) {
    socket.join(ROOM_SYSTEM_ADMINS);
    socket.join(ROOM_ADMINS);
    return;
  }

  if (user.role === ROLES.DEPT_ADMIN) {
    socket.join(ROOM_ADMINS);
  }
}

module.exports = {
  ROOM_ADMINS,
  ROOM_SYSTEM_ADMINS,
  attachSocketRooms,
  departmentRoom,
  userRoom,
};
