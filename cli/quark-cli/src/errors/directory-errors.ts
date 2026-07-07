export class DirectoryAlreadyExistsError extends Error {
    constructor(directoryName: string) {
        super(`Directory "${directoryName}" already exists.`);
        this.name = "DirectoryAlreadyExistsError";
    }
}
