import { Router } from "express";
import {
  addMemberToProject,
  createProject,
  deleteMember,
  getProjects,
  getProjectById,
  getProjectMembers,
  updateProject,
  deleteProject,
  updateMemberRole,
} from "../controllers/project.controllers.js";
import { validate } from "../middlewares/validator.middlewares.js";
import {
  createProjectValidator,
  addMemberToProjectValidator,
  updateMemberRoleValidator,
  mongoIdParams,
} from "../validators/index.js";
import {
  verifyJWT,
  validateProjectPermission,
  requireVerifiedEmail,
} from "../middlewares/auth.middlewares.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
router.use(verifyJWT, requireVerifiedEmail);

router
  .route("/")
  .get(getProjects)
  .post(createProjectValidator(), validate, createProject);

router
  .route("/:projectId")
  .get(validateProjectPermission(AvailableUserRole), getProjectById)
  .put(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    createProjectValidator(),
    validate,
    updateProject,
  )
  .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteProject);

router
  .route("/:projectId/members")
  .get(validateProjectPermission(AvailableUserRole), getProjectMembers)
  .post(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    addMemberToProjectValidator(),
    validate,
    addMemberToProject,
  );

router
  .route("/:projectId/members/:userId")
  .put(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    updateMemberRoleValidator(),
    validate,
    updateMemberRole,
  )
  .delete(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    ...mongoIdParams("userId"),
    validate,
    deleteMember,
  );

export default router;
