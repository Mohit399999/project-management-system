import { Project } from "../models/project.models.js";
import { User } from "../models/user.models.js";
import { Task } from "../models/task.models.js";
import { SubTask } from "../models/subtask.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import mongoose from "mongoose";

const findSubTaskInProject = async (subTaskId, projectId) => {
  if (!mongoose.isValidObjectId(subTaskId)) return null;
  const subTask = await SubTask.findById(subTaskId);
  if (!subTask) return null;
  const parentInProject = await Task.exists({
    _id: subTask.task,
    project: projectId,
  });
  return parentInProject ? subTask : null;
};
const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "project not found");
  }
  const files = req.files || [];

  const attachments = files.map((file) => {
    return {
      url: `${process.env.SERVER_URL}/images/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });
  const task = await Task.create({
    title,
    description,
    project: new mongoose.Types.ObjectId(projectId),
    assignedTo: assignedTo
      ? new mongoose.Types.ObjectId(assignedTo)
      : undefined,
    assignedBy: new mongoose.Types.ObjectId(req.user._id),
    attachments,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "task created sucessfully"));
});
const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "project not found");
  }

  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  }).populate("assignedTo", "avatar username fullname");
  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "tasks fetched successfully"));
});
const getTaskById = asyncHandler(async (req, res) => {
  const { taskId, projectId } = req.params;

  const task = await Task.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(taskId),
        project: new mongoose.Types.ObjectId(projectId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedTo",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subtasks",
        localField: "_id",
        foreignField: "task",
        as: "subtasks",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              createdBy: {
                $arrayElemAt: ["$createdBy", 0],
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        assignedTo: {
          $arrayElemAt: ["$assignedTo", 0],
        },
      },
    },
  ]);

  if (!task || task.length === 0) {
    throw new ApiError(404, "Task not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, task[0], "Task fetched successfully"));
});
const updateTask = asyncHandler(async (req, res) => {
  const { taskId, projectId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  const files = req.files || [];

  const attachments = files.map((file) => {
    return {
      url: `${process.env.SERVER_URL}/images/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

  const task = await Task.findOneAndUpdate(
    { _id: taskId, project: projectId },
    {
      title,
      description,
      status,
      assignedTo: assignedTo
        ? new mongoose.Types.ObjectId(assignedTo)
        : undefined,
      ...(attachments.length > 0 && {
        $push: { attachments: { $each: attachments } },
      }),
    },
    { new: true, runValidators: true },
  );
  if (!task) {
    throw new ApiError(404, "task not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, task, "task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const task = await Task.findOneAndDelete({
    _id: taskId,
    project: projectId,
  });

  if (!task) {
    throw new ApiError(404, "task not found");
  }
  await SubTask.deleteMany({ task: taskId });
  return res
    .status(200)
    .json(new ApiResponse(200, task, "task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title } = req.body;

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) {
    throw new ApiError(404, "task not found");
  }
  const subTask = await SubTask.create({
    title,
    task: new mongoose.Types.ObjectId(taskId),
    createdBy: new mongoose.Types.ObjectId(req.user._id),
  });
  return res
    .status(201)
    .json(new ApiResponse(201, subTask, "subtask created successfully"));
});

const updateSubTask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;
  const { title, isCompleted } = req.body ?? {};

  const existing = await findSubTaskInProject(subTaskId, projectId);
  if (!existing) {
    throw new ApiError(404, "subtask not found");
  }

  const isMember = req.user.role === UserRolesEnum.MEMBER;

  if (isMember && title !== undefined) {
    throw new ApiError(
      403,
      "members can only update the completion status of a subtask",
    );
  }
  if (isMember && typeof isCompleted !== "boolean") {
    throw new ApiError(400, "isCompleted (true/false) is required");
  }

  const update = isMember ? { isCompleted } : { title, isCompleted };

  const subTask = await SubTask.findByIdAndUpdate(existing._id, update, {
    new: true,
    runValidators: true,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, subTask, "subtask updated successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;

  const existing = await findSubTaskInProject(subTaskId, projectId);
  if (!existing) {
    throw new ApiError(404, "subtask not found");
  }

  await SubTask.findByIdAndDelete(existing._id);
  return res
    .status(200)
    .json(new ApiResponse(200, existing, "subtask deleted successfully"));
});

export {
  createSubTask,
  createTask,
  deleteTask,
  deleteSubTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
};
