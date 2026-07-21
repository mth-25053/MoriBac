import type { MetadataRoute } from "next";
export default function sitemap():MetadataRoute.Sitemap{const base=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000";const lastModified=new Date();return[{url:base,lastModified,changeFrequency:"daily",priority:1},{url:`${base}/about`,lastModified,changeFrequency:"monthly",priority:.5}]}
