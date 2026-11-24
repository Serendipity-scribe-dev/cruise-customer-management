// Local dev only. On Vercel the app runs from api/index.js
import { createApp } from "./server/app.js";

const port = process.env.PORT || 3001;
createApp().listen(port, () => console.log(`API running on http://localhost:${port}`));
