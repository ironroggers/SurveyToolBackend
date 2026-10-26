import { isAdmin } from "../services/access.service.js";

// The demo block and everything under it is shown to ADMIN only; lists and guards leave
// it out for everyone else (services/access.service.js).
export const seesDemo = (req) => isAdmin(req);
