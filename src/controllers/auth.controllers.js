import { User } from "../models/user.models.js";
import {ApiError} from "../utils/api-error.js"
import { ApiResponse } from "../utils/api-respose.js";
import { asyncHandler } from "../utils/async-handler.js";
import {emailVerificationMailgenContent,sendMail} from "../utils/mail.js"

const generateAccessAndRefreshTokens=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken=user.generateAcessToken()
        const refreshToken=user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"something went wrong while generating access token")
    }
}

const registerUser=asyncHandler(async (req,res)=>{
    //first getting the values from the req 
    const{username,email,password,role}=req.body

    //serching in the db if user already exists
    const existingUser=await User.findOne({
        $or:[{username},{email}]
    })

    //if user already exist throwing error 
    if(existingUser){
        throw new ApiError(409,"user with same email or username already exists",[])
    }
    
    //if everything is fine creating user in db

    const user=await User.create({
        username,
        email,
        password,
        isEmailVerified:false,
    })

    // now generating temporary token so that we can send verification mail
    const {unHashedToken, hashedToken, tokenExpiry}=user.generateTemporaryToken()
    user.emailVerificationToken=hashedToken
    user.emailVerificationExpiry=tokenExpiry

    await user.save({validateBeforeSave:false})

    await sendMail({
        email:user?.email,
        subject:"please verify your email",
        mailgenContent:emailVerificationMailgenContent(
            user.username,
            `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
        )
    })

    const createdUser =await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",)

    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(201,
            {user:createdUser},
        "user registered sucessfully and verification email has been sent on your email")
    )
})

const login=asyncHandler(async (req,res)=>{
    const {email,password,username}=req.body

    if(!email && !username){
        throw new ApiError(400,"username or email is required")
    }


    const user = await User.findOne(
    username ? { username } : { email }
);
    if(!user){
        throw new ApiError(400,"user does not exists")
    }


    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(400,"Invalid credentials")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

    const loggedInuser =await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",)
    
    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,
            {
                user:loggedInuser,
                accessToken,
                refreshToken
            },
            "user logged in succesfully"
        )
        )
    

})
export {registerUser,login}
