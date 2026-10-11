import mongoose from "mongoose";
import { Project } from "../models/project.models.js";
import { ProjectNote } from "../models/note.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const getNotes = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "project not found");
  }

  const notes = await ProjectNote.find({
    project: new mongoose.Types.ObjectId(projectId),
  })
    .populate("createdBy", "avatar username fullName")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, notes, "notes fetched successfully"));
});

const getNoteById = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await ProjectNote.findOne({
    _id: noteId,
    project: projectId,
  }).populate("createdBy", "avatar username fullName");

  if (!note) {
    throw new ApiError(404, "note not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, note, "note fetched successfully"));
});

const createNote = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "project not found");
  }

  const note = await ProjectNote.create({
    project: new mongoose.Types.ObjectId(projectId),
    createdBy: new mongoose.Types.ObjectId(req.user._id),
    content,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, note, "note created successfully"));
});

const updateNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;
  const { content } = req.body;

  const note = await ProjectNote.findOneAndUpdate(
    { _id: noteId, project: projectId },
    { content },
    { new: true, runValidators: true },
  );

  if (!note) {
    throw new ApiError(404, "note not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, note, "note updated successfully"));
});

const deleteNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await ProjectNote.findOneAndDelete({
    _id: noteId,
    project: projectId,
  });

  if (!note) {
    throw new ApiError(404, "note not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, note, "note deleted successfully"));
});

export { createNote, deleteNote, getNoteById, getNotes, updateNote };