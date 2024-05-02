import bcrypt from "bcryptjs"
import { v2 as cloudinary } from "cloudinary"
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

export const getUserProfile = async(req,res) => {
    try {
        let { username } = req.params;
        username = username.trim();
        const user = await User.findOne({ username }).select("-password")
        if(!user){
            return res.status(400).json({ error: "User not found" })
        }
        res.status(200).json(user)
    } catch (error) {
        console.log(`Error in userProfile controller: ${error.message}`)
       return  res.status(400).json({ error: "internal server error" })
    }
}


export const suggestedUser = async(req,res) => {
    try {
        const userId = req.user._id;
        const usersFollowedByMe = await User.findById(userId).select("following");

        const followedUsers = usersFollowedByMe.following;
        const suggestedUsers = await User.aggregate([
            {
                $match: {
                    _id: {$nin: [...followedUsers, userId]} //Exclude the current as well as users already followed
                },
            },
            {
                $project: {
                    password: 0 //Exclude the password field
                }
            },
            { $sample: {size: 5} }
        ]);

        res.status(200).json(suggestedUsers)

    } catch (error) {
        console.log(`Error in suggested-User controller: ${error.message}`)
       return  res.status(400).json({ error: "internal server error" })
    }
}


export const followUnfollowUser = async(req,res) => {
    try {
        const {id} = req.params
        const userToModify = await User.findById(id);
        const currentUser = await User.findById(req.user._id)

        if(id === req.user._id.toString()){
            return res.status(400).json({ error: "You can't follow or unfollow yourself " })
        }

        if(!userToModify || !currentUser){
            return res.status(400).json({ error: "User not found"})
        }

        const isfollowing = currentUser.following.includes(id);
        if(isfollowing){
            // unfollow the user 
            
            await User.findByIdAndUpdate(id, {$pull: { followers: req.user._id}})
            await User.findByIdAndUpdate(req.user._id, {$pull: { following: id}})

            // return the id of the user as a response

            res.status(200).json({ message: "User unfollowed" })
        } else {
            // Follow the user
            await User.findByIdAndUpdate(id, {$push: { followers: req.user._id}})
            await User.findByIdAndUpdate(req.user._id, {$push: { following: id}})
            
            // notify user 
            const notification = new Notification({
                type: "follow",
                from: req.user._id,
                to: userToModify._id
            })
            
            await notification.save();
            
            // return the id of the user as a response
            res.status(200).json({ message: "User followed" })
        }


    } catch (error) {
        console.log(`Error in followUnfolowUser controller: ${error.message}`)
        return  res.status(400).json({ error: "internal server error" })
    }
}


export const updateProfile = async(req,res) => {
    const { fullName, username, email, currentPassword, newPassword, bio, link } = req.body;
    let { profileImg, coverImg } = req.body;
    const userId = req.user._id;
    try {
        let user = await User.findById(userId);
        if(!user){
            return res.status(400).json({ error: "User not found!" })
        }

        if((!newPassword && currentPassword) || (newPassword && !currentPassword)){
            return res.status(400).json({ error: "Please provide both current and new password" })
        }

        if(currentPassword && newPassword){
            const isMatch = await bcrypt.compare(currentPassword, user.password)
            if(!isMatch){
                return res.status(400).json({ error: "Passwords do not match" })
            }

            if(newPassword.length < 6){
                return res.status(400).json({ error: "Password must be atleast 6 characters long" })
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword,salt)
        }

        if(profileImg){
            if(user.profileImg){
                await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0])
            }
            const uploadedImage = await cloudinary.uploader.upload(profileImg);
            profileImg = uploadedImage.secure_url;  
        }

        if(coverImg){
            if(user.coverImg){
                await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0])
            }
            const uploadedImage = await cloudinary.uploader.upload(coverImg);
            profileImg = uploadedImage.secure_url;  
        }

        user.fullName = fullName || user.fullName;
        user.username = username || user.username;
        user.bio = bio || user.bio;
        user.email = email || user.email;
        user.bio = bio || user.bio;
        user.link = link || user.link;
        user.profileImg = profileImg || user.profileImg;
        user.coverImg = coverImg || user.coverImg;
        
        user = await user.save();

        user.password = null; // Exclude password

        res.status(200).json(user);


    } catch (error) {
        console.log(`Error in updateProfile controller: ${error.message}`)
        return  res.status(400).json({ error: "internal server error" })
    }
}