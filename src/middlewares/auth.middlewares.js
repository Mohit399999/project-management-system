import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ProjectMember } from "../models/projectmember.models.js";
import mongoose from "mongoose";
asyncHandler;
ApiError;
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry",
    );

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Invalid access token");
  }
});

export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    throw new ApiError(403, "please verify your email to access this resource");
  }
  next();
};

export const validateProjectPermission = (roles = []) =>
  asyncHandler(async (req, res, next) => {
    const { projectId } = req.params;
    if (!projectId) {
      throw new ApiError(400, "project id is missing");
    }
    if (!mongoose.isValidObjectId(projectId)) {
      throw new ApiError(400, "invalid project id");
    }

    const project = await ProjectMember.findOne({
      user: new mongoose.Types.ObjectId(req.user._id),
      project: new mongoose.Types.ObjectId(projectId),
    });
    if (!project) {
      throw new ApiError(403, "access denied");
    }
    const givenRole = project?.role;
    req.user.role = givenRole;
    if (!roles.includes(project.role)) {
      throw new ApiError(
        403,
        "you do not have permission to perform this action",
      );
    }
    next();
  });
