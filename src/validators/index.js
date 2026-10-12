import { body, param } from "express-validator";
import { AvailableUserRole, AvailableTaskStatus } from "../utils/constants.js";
import { ProjectMember } from "../models/projectmember.models.js";

const userRegisterValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
    body("username")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLowercase()
      .withMessage("Username must be in lowercase")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters long"),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    body("fullName").optional().trim(),
  ];
};

const userLoginValidator = () => {
  return [
    body("email").optional().trim().isEmail().withMessage("Email is invalid"),
    body("username")
      .optional()
      .trim()
      .isLowercase()
      .withMessage("Username must be in lowercase"),
    body("password").trim().notEmpty().withMessage("Password is required"),
  ];
};

const userChangeCurrentPasswordValidator = () => {
  return [
    body("currentPassword")
      .trim()
      .notEmpty()
      .withMessage("Password is required"),
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ];
};

const userForgotPasswordValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
  ];
};

const userResetForgotPasswordValidator = () => {
  return [
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ];
};

const createProjectValidator = () => {
  return [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Project name is required")
      .isLength({ min: 3 })
      .withMessage("Project name must be at least 3 characters long"),
    body("description").optional().trim(),
  ];
};

const addMemberToProjectValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
    body("role")
      .trim()
      .notEmpty()
      .withMessage("Role is required")
      .isIn(AvailableUserRole)
      .withMessage("Role is invalid"),
  ];
};
const updateMemberRoleValidator = () => [
  ...mongoIdParams("userId"),
  body("role").trim().notEmpty().withMessage("Role is required")
    .isIn(AvailableUserRole).withMessage("Invalid role"),
];

const createTaskValidator = () => {
  return [
    param("projectId").isMongoId().withMessage("Invalid project id"),

    body("title")
      .trim()
      .notEmpty()
      .withMessage("Task title is required")
      .isLength({ min: 3 })
      .withMessage("Task title must be at least 3 characters long"),

    body("description").optional().trim(),

    body("assignedTo")
      .notEmpty()
      .withMessage("assignedTo is required")
      .bail()
      .isMongoId()
      .withMessage("assignedTo must be a valid user id")
      .bail()
      .custom((value, { req }) => {
        if (value === req.user._id) {
          throw new Error("You cannot assign a task to yourself");
        }
        return true;
      }),

    
  ];
};
const mongoIdParams = (...names) =>
  names.map((name) => param(name).isMongoId().withMessage(`Invalid ${name}`));

const assigneeIsProjectMember = (value, { req }) =>
  ProjectMember.exists({ user: value, project: req.params.projectId }).then(
    (isMember) => {
      if (!isMember) throw new Error("assigned user is not a member of this project");
      return true;
    },
  );

const updateTaskValidator = () => [
  ...mongoIdParams("taskId"),
  body("title").optional().trim().notEmpty().withMessage("Task title cannot be empty")
    .isLength({ min: 3 }).withMessage("Task title must be at least 3 characters long"),
  body("description").optional().trim(),
  body("assignedTo").optional().isMongoId().withMessage("assignedTo must be a valid user id")
    .bail().custom(assigneeIsProjectMember),
  body("status").optional().isIn(AvailableTaskStatus)
    .withMessage(`Status must be one of: ${AvailableTaskStatus.join(", ")}`),
];

const createSubTaskValidator = () => [
  ...mongoIdParams("taskId"),
  body("title").trim().notEmpty().withMessage("Subtask title is required")
    .isLength({ min: 3 }).withMessage("Subtask title must be at least 3 characters long"),
];

const updateSubTaskValidator = () => [
  ...mongoIdParams("subTaskId"),
  body("title").optional().trim().notEmpty().withMessage("Subtask title cannot be empty"),
  body("isCompleted").optional().isBoolean().withMessage("isCompleted must be true or false")
    .bail().toBoolean(),
];

const noteContentValidator = () => [
  body("content").trim().notEmpty().withMessage("Note content is required"),
];
export {
  userRegisterValidator,
  userLoginValidator,
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userResetForgotPasswordValidator,
  createProjectValidator,
  addMemberToProjectValidator,
  updateMemberRoleValidator,
  createTaskValidator,
  updateTaskValidator,
  createSubTaskValidator,
  updateSubTaskValidator,
  noteContentValidator,
  mongoIdParams

};
