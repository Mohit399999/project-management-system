import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "../controllers/note.controllers.js";
import {
  verifyJWT,
  validateProjectPermission,
  requireVerifiedEmail,
} from "../middlewares/auth.middlewares.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { noteContentValidator, mongoIdParams } from "../validators/index.js";
import { validate } from "../middlewares/validator.middlewares.js";

const router = Router();
router.use(verifyJWT, requireVerifiedEmail);

router
  .route("/:projectId")
  .get(validateProjectPermission(AvailableUserRole), getNotes)
  .post(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    noteContentValidator(),
    validate,
    createNote,
  );

router
  .route("/:projectId/n/:noteId")
  .get(
    validateProjectPermission(AvailableUserRole),
    ...mongoIdParams("noteId"),
    validate,
    getNoteById,
  )
  .put(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    ...mongoIdParams("noteId"),
    noteContentValidator(),
    validate,
    updateNote,
  )
  .delete(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    ...mongoIdParams("noteId"),
    validate,
    deleteNote,
  );

export default router;
