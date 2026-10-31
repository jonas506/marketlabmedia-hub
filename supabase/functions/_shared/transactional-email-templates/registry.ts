import type * as React from 'npm:react@18.3.1';
import {resultTemplate,ownerTemplate} from './vertriebs-check.tsx';
export interface TemplateEntry { component:React.ComponentType<any>;subject:string|((data:Record<string,any>)=>string);displayName?:string;previewData?:Record<string,any>;to?:string; }
export const TEMPLATES:Record<string,TemplateEntry>={'vertriebs-check-result':resultTemplate,'vertriebs-check-owner':ownerTemplate};
