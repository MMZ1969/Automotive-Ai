import * as AuthService from "./auth.service.js";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const user = await AuthService.registerUser(req.body);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const result = await AuthService.loginUser(req.body);

    res.status(200).json({
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(400).json({ message: err.message });
  }
};