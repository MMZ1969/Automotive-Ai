import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["diyer", "mechanic", "shop"], "Invalid role"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const validateRegister = (req, res, next) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    console.error("REGISTER VALIDATION ERROR:", result.error);
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.errors,
    });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    console.error("LOGIN VALIDATION ERROR:", result.error);
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.errors,
    });
  }

  next();
};