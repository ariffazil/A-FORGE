import { access } from "node:fs/promises";
import { constants } from "node:fs";
export async function pathExists(filePath) {
    try {
        await access(filePath, constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
