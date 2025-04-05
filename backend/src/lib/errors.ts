export class NestedError{
    constructor(
        readonly message : string | undefined,
        readonly error : any | undefined
    ) {}
}

export class VersionConflictError{}