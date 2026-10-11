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

const createTask=asyncHandler(async(req,res)=>{
    const {title,description,assignedTo,status}=req.body;
    const {projectId}=req.params;
    const project =await Project.findById(projectId)

    if(!project){
        throw new ApiError(404,"project not found")
    }
    const files= req.files || [];

    const atachments=files.map((file)=>{
        return {
            url:`${process.env.SERVER_URL}/images/${file.originalname}`,
            mimetype:file.mimetype,
            size:file.size,
        }
    })
    const task=await Task.create({
        title,
        description,
        project:new mongoose.Types.ObjectId(projectId),
        assignedTo:assignedTo ?new mongoose.Types.ObjectId(assignedTo) : undefined,
        assignedBy:new mongoose.Types.ObjectId(req.user._id),
        atachments

    })

    return res.status(201)
    .json(
        new ApiResponse(201,task,"task created sucessfully")
    )

})
const getTasks=asyncHandler(async(req,res)=>{
    const {projectId}=req.params;
    const project =await Project.findById(projectId)

    if(!project){
        throw new ApiError(404,"project not found")
    }

    const tasks=await Task.find({project:new mongoose.Types.ObjectId(projectId)}).populate("assignedTo","avatar username fullname")
    return res.status(200)
    .json(
        new ApiResponse(200,tasks,"tasks fetched successfully")
    )
})
const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(taskId),
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
            _id: 1,
            username: 1,
            fullName: 1,
            avatar: 1,
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
  const { taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  const files = req.files || [];

  const attachments = files.map((file) => {
    return {
      url: `${process.env.SERVER_URL}/images/${file.originalname}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

  const task = await Task.findByIdAndUpdate(
    taskId,
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
  const { taskId } = req.params;
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) {
    throw new ApiError(404, "task not found");
  }
  await SubTask.deleteMany({ task: taskId });
  return res
    .status(200)
    .json(new ApiResponse(200, task, "task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;

  const task = await Task.findById(taskId);
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
  const { subTaskId } = req.params;
  const { title, isCompleted } = req.body;

  const subTask = await SubTask.findByIdAndUpdate(
    subTaskId,
    {
      title,
      isCompleted,
    },
    { new: true, runValidators: true },
  );
  if (!subTask) {
    throw new ApiError(404, "subtask not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, subTask, "subtask updated successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;
  const subTask = await SubTask.findByIdAndDelete(subTaskId);

  if (!subTask) {
    throw new ApiError(404, "subtask not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, subTask, "subtask deleted successfully"));
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