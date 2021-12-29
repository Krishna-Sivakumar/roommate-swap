if (!process.env.VSWAP_CLIENT_ID || !process.env.VSWAP_CLIENT_SECRET || !process.env.VSWAP_SESSION_SECRET) {
    throw new Error("You must set the VSWAP_CLIENT_ID, VSWAP_SESSION_SECRET, and VSWAP_CLIENT_SECRET environment variables to run VSwap.");
}
export const SESSION_SECRET = process.env.VSWAP_SESSION_SECRET;
export const GOOGLE_CLIENT_ID: string = process.env.VSWAP_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET: string = process.env.VSWAP_CLIENT_SECRET;
export const redirectURIs = [
    "http://localhost:4000/auth/google"
];
export const SERVER_ROOT_URI = "http://localhost:4000";
