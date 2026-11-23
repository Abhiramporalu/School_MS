import { Role } from "@prisma/client";
import { prisma } from "../db.js";
async function authenticate(req, res, next) {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { teacher: true, student: true }
    });
    if (!user) {
      req.session.destroy(() => void 0);
      res.status(401).json({ error: "Session is no longer valid" });
      return;
    }
    if (user.role === Role.TEACHER && !user.teacher || user.role === Role.STUDENT && (!user.student || user.student.status !== "ACTIVE")) {
      req.session.destroy(() => void 0);
      res.status(403).json({ error: "Your account is inactive or its profile is incomplete. Contact a school administrator." });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      profileId: user.teacher?.id ?? user.student?.id ?? null,
      fullName: user.teacher?.fullName ?? user.student?.fullName ?? null
    };
    next();
  } catch (error) {
    next(error);
  }
}
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
export {
  allowRoles,
  authenticate
};
