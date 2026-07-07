import { dedent } from "ts-dedent";

export const tsconfig = dedent(`{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["ES2018", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",

    "module": "Node16",
    "moduleResolution": "Node16",

    "resolveJsonModule": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "declarationDir": "./dist",

    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.stories.*",
    "**/*.test.*",
    "**/*.spec.*"
  ]
}`);
