import "./index";

const hasSelf = typeof self !== "undefined";
const envGlobal = hasSelf ? self : global;

export default (envGlobal as any).rqjs