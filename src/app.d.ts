// // src/app.d.ts
declare global {
	namespace App {
		interface Locals {
			supabase: import('@supabase/supabase-js').SupabaseClient;
			user: import('@supabase/supabase-js').User | null;
		}
	}
}
declare module '*.mjs?url' {
	const src: string;
	export default src;
}


export { };
