import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config'

const getBranchName = () => {
    if(process.env.BRANCH_NAME == null){
        throw new Error("Branch name was not found.")
    }
    return process.env.BRANCH_NAME
}

export default mergeConfig(viteConfig, defineConfig({
    base: `/janken-cafe/branch/${getBranchName()}`,
}))