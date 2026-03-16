import { getCurrentUser } from "./me.service.js";

export const meController = async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        ok: false,
        status: 404,
        error: "User not found",
      });
    }

    return res.status(200).json({
      ok: true,
      status: 200,
      user,
    });
  } catch (err) {
    console.error("ME_CONTROLLER_ERROR", err);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "Something went wrong",
    });
  }
};