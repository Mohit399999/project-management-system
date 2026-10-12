import { Project } from "../models/project.models.js";
import { User } from "../models/user.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { sendMail, projectInviteMailgenContent } from "../utils/mail.js";
import { Task } from "../models/task.models.js";
import { SubTask } from "../models/subtask.models.js";
import { ProjectNote } from "../models/note.models.js";
import mongoose from "mongoose";

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  let project;
  try {
    project = await Project.create({
      name,
      description,
      createdBy: req.user._id,
    });
    await ProjectMember.create({
      user: req.user._id,
      project: project._id,
      role: UserRolesEnum.ADMIN,
    });
  } catch (error) {
    if (project) await Project.findByIdAndDelete(project._id);
    throw error; 
  }
  return res
    .status(201)
    .json(new ApiResponse(201, project, "project created successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;
  const project = await Project.findByIdAndUpdate(
    projectId,
    {
      name,
      description,
    },
    { new: true, runValidators: true },
  );
  if (!project) {
    throw new ApiError(404, "project not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, project, "project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findByIdAndDelete(projectId);

  if (!project) {
    throw new ApiError(404, "project not found");
  }
  const tasks = await Task.find({ project: projectId }).select(
    "_id attachments",
  );
  await SubTask.deleteMany({ task: { $in: tasks.map((t) => t._id) } });
  await Task.deleteMany({ project: projectId });
  await ProjectNote.deleteMany({ project: projectId });
  await ProjectMember.deleteMany({ project: projectId });
  return res
    .status(200)
    .json(new ApiResponse(200, project, "project deleted successfully"));
});

const getProjects = asyncHandler(async (req, res) => {
  const projects = await ProjectMember.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "projects",
        localField: "project",
        foreignField: "_id",
        as: "projects",
        pipeline: [
          {
            $lookup: {
              from: "projectmembers",
              localField: "_id",
              foreignField: "project",
              as: "projectmembers",
            },
          },
          {
            $addFields: {
              members: {
                $size: "$projectmembers",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$projects",
    },
    {
      $project: {
        projects: {
          _id: 1,
          name: 1,
          description: 1,
          members: 1,
          createdAt: 1,
          createdBy: 1,
        },
        role: 1,
        _id: 0,
      },
    },
  ]);
  return res
    .status(200)
    .json(new ApiResponse(200, projects, "project fetched successfully"));
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "project not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, project, "project fetched successfully"));
});

const addMemberToProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { email, role } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, "user not found");

  const alreadyMember = await ProjectMember.exists({
    user: user._id,
    project: projectId,
  });
  if (alreadyMember) {
    throw new ApiError(
      409,
      "user is already a member of this project, use the update role endpoint instead",
    );
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, "project not found");

  await ProjectMember.create({ user: user._id, project: project._id, role });

  let emailSent = true;
  try {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    await sendMail({
      email: user.email,
      subject: `You have been added to ${project.name}`,
      mailgenContent: projectInviteMailgenContent(
        user.username,
        project.name,
        role,
        `${clientUrl}/projects/${project._id}`,
      ),
    });
  } catch (error) {
    emailSent = false;
    console.error(`Invite email failed for ${user.email}:`, error.message);
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, { emailSent }, "project member added successfully"),
    );
});

const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "project not found");
  }
  const projectMembers = await ProjectMember.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              _id: 1,
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        user: { $arrayElemAt: ["$user", 0] },
      },
    },
    {
      $project: {
        project: 1,
        user: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
        _id: 0,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        projectMembers,
        "project members fetched successfully",
      ),
    );
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { role: newRole } = req.body;

  if (!AvailableUserRole.includes(newRole)) {
    throw new ApiError(400, "invalid role");
  }

  let projectMember = await ProjectMember.findOne({
    user: new mongoose.Types.ObjectId(userId),
    project: new mongoose.Types.ObjectId(projectId),
  });
  if (!projectMember) {
    throw new ApiError(404, "project member not found");
  }
  projectMember = await ProjectMember.findByIdAndUpdate(
    projectMember._id,
    { role: newRole },
    { new: true },
  );
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "project member role updated successfully"));
});

const deleteMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  let projectMember = await ProjectMember.findOneAndDelete({
    user: new mongoose.Types.ObjectId(userId),
    project: new mongoose.Types.ObjectId(projectId),
  });
  if (!projectMember) {
    throw new ApiError(404, "project member not found");
  }
  projectMember = await ProjectMember.findByIdAndDelete(projectMember._id);
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "project member deleted successfully"));
});
export {
  createProject,
  updateProject,
  deleteProject,
  getProjects,
  getProjectById,
  addMemberToProject,
  getProjectMembers,
  updateMemberRole,
  deleteMember,
};
