"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Code,
  Copy,
  Check,
  Download,
  Globe,
  Building,
  FileText,
  HelpCircle,
  Star,
  ShoppingBag,
  Calendar,
  MapPin,
  Utensils,
  GraduationCap,
  Briefcase,
} from "lucide-react";

type SchemaType =
  | "Organization"
  | "LocalBusiness"
  | "WebSite"
  | "WebPage"
  | "Article"
  | "BlogPosting"
  | "Product"
  | "FAQPage"
  | "HowTo"
  | "Event"
  | "JobPosting"
  | "Course"
  | "Recipe"
  | "Review";

interface SchemaField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "url" | "date" | "select";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

const schemaConfigs: Record<SchemaType, SchemaField[]> = {
  Organization: [
    { name: "name", label: "Tên tổ chức", type: "text", required: true },
    { name: "url", label: "Website", type: "url", required: true },
    { name: "logo", label: "Logo URL", type: "url", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "email", label: "Email", type: "text" },
    { name: "telephone", label: "Điện thoại", type: "text" },
    { name: "sameAs", label: "Social Profiles (mỗi dòng 1 cái)", type: "textarea", placeholder: "https://facebook.com/...\nhttps://twitter.com/..." },
  ],
  LocalBusiness: [
    { name: "name", label: "Tên doanh nghiệp", type: "text", required: true },
    { name: "url", label: "Website", type: "url", required: true },
    { name: "telephone", label: "Điện thoại", type: "text", required: true },
    { name: "address", label: "Địa chỉ", type: "textarea", required: true, placeholder: "123 Street, City, Country" },
    { name: "image", label: "Hình ảnh URL", type: "url" },
    { name: "priceRange", label: "Khoảng giá", type: "text", placeholder: "$$$" },
    { name: "openingHours", label: "Giờ mở cửa", type: "text", placeholder: "Mo-Fr 09:00-17:00" },
  ],
  WebSite: [
    { name: "name", label: "Tên website", type: "text", required: true },
    { name: "url", label: "URL", type: "url", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "searchUrl", label: "URL tìm kiếm", type: "url", placeholder: "https://example.com/search?q={search_term_string}" },
  ],
  WebPage: [
    { name: "name", label: "Tiêu đề trang", type: "text", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "url", label: "URL", type: "url", required: true },
    { name: "image", label: "Hình ảnh đại diện", type: "url" },
    { name: "datePublished", label: "Ngày xuất bản", type: "date" },
    { name: "dateModified", label: "Ngày cập nhật", type: "date" },
  ],
  Article: [
    { name: "headline", label: "Tiêu đề", type: "text", required: true },
    { name: "author", label: "Tác giả", type: "text", required: true },
    { name: "publisher", label: "Nhà xuất bản", type: "text", required: true },
    { name: "url", label: "URL bài viết", type: "url", required: true },
    { name: "image", label: "Hình ảnh", type: "url", required: true },
    { name: "datePublished", label: "Ngày xuất bản", type: "date", required: true },
    { name: "dateModified", label: "Ngày cập nhật", type: "date" },
    { name: "description", label: "Tóm tắt", type: "textarea" },
  ],
  BlogPosting: [
    { name: "headline", label: "Tiêu đề", type: "text", required: true },
    { name: "author", label: "Tác giả", type: "text", required: true },
    { name: "url", label: "URL", type: "url", required: true },
    { name: "image", label: "Hình ảnh", type: "url" },
    { name: "datePublished", label: "Ngày đăng", type: "date", required: true },
    { name: "articleBody", label: "Nội dung", type: "textarea" },
  ],
  Product: [
    { name: "name", label: "Tên sản phẩm", type: "text", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "image", label: "Hình ảnh", type: "url" },
    { name: "brand", label: "Thương hiệu", type: "text" },
    { name: "sku", label: "SKU", type: "text" },
    { name: "price", label: "Giá", type: "number" },
    { name: "priceCurrency", label: "Tiền tệ", type: "text", placeholder: "USD, VND, EUR..." },
    { name: "availability", label: "Tình trạng", type: "select", options: ["InStock", "OutOfStock", "PreOrder"] },
    { name: "rating", label: "Đánh giá (1-5)", type: "number" },
    { name: "reviewCount", label: "Số lượt đánh giá", type: "number" },
  ],
  FAQPage: [
    { name: "faqs", label: "FAQ Items (mỗi dòng: Câu hỏi | Câu trả lời)", type: "textarea", required: true, placeholder: "Câu hỏi 1? | Câu trả lời 1\nCâu hỏi 2? | Câu trả lời 2" },
  ],
  HowTo: [
    { name: "name", label: "Tên hướng dẫn", type: "text", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "image", label: "Hình ảnh", type: "url" },
    { name: "totalTime", label: "Thời gian (ISO 8601)", type: "text", placeholder: "PT30M" },
    { name: "estimatedCost", label: "Chi phí ước tính", type: "text" },
    { name: "steps", label: "Các bước (mỗi dòng 1 bước)", type: "textarea", required: true },
  ],
  Event: [
    { name: "name", label: "Tên sự kiện", type: "text", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "startDate", label: "Ngày bắt đầu", type: "date", required: true },
    { name: "endDate", label: "Ngày kết thúc", type: "date" },
    { name: "location", label: "Địa điểm", type: "text" },
    { name: "image", label: "Hình ảnh", type: "url" },
    { name: "price", label: "Giá vé", type: "number" },
    { name: "currency", label: "Tiền tệ", type: "text", placeholder: "USD, VND..." },
  ],
  JobPosting: [
    { name: "title", label: "Chức danh", type: "text", required: true },
    { name: "description", label: "Mô tả công việc", type: "textarea", required: true },
    { name: "company", label: "Công ty", type: "text", required: true },
    { name: "location", label: "Địa điểm", type: "text", required: true },
    { name: "employmentType", label: "Loại công việc", type: "select", options: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] },
    { name: "salary", label: "Mức lương", type: "text" },
    { name: "datePosted", label: "Ngày đăng", type: "date", required: true },
  ],
  Course: [
    { name: "name", label: "Tên khóa học", type: "text", required: true },
    { name: "description", label: "Mô tả", type: "textarea" },
    { name: "provider", label: "Nhà cung cấp", type: "text", required: true },
    { name: "url", label: "URL khóa học", type: "url" },
    { name: "image", label: "Hình ảnh", type: "url" },
  ],
  Recipe: [
    { name: "name", label: "Tên món", type: "text", required: true },
    { name: "author", label: "Tác giả", type: "text" },
    { name: "image", label: "Hình ảnh", type: "url" },
    { name: "prepTime", label: "Thời gian chuẩn bị", type: "text", placeholder: "PT15M" },
    { name: "cookTime", label: "Thời gian nấu", type: "text", placeholder: "PT30M" },
    { name: "ingredients", label: "Nguyên liệu (mỗi dòng 1 cái)", type: "textarea", required: true },
    { name: "instructions", label: "Hướng dẫn (mỗi dòng 1 bước)", type: "textarea", required: true },
  ],
  Review: [
    { name: "itemName", label: "Tên sản phẩm/dịch vụ", type: "text", required: true },
    { name: "reviewer", label: "Người đánh giá", type: "text", required: true },
    { name: "reviewBody", label: "Nội dung đánh giá", type: "textarea" },
    { name: "rating", label: "Số sao (1-5)", type: "number", required: true },
    { name: "datePublished", label: "Ngày đánh giá", type: "date", required: true },
  ],
};

const schemaIcons: Record<SchemaType, React.ElementType> = {
  Organization: Building,
  LocalBusiness: MapPin,
  WebSite: Globe,
  WebPage: Globe,
  Article: FileText,
  BlogPosting: FileText,
  Product: ShoppingBag,
  FAQPage: HelpCircle,
  HowTo: Code,
  Event: Calendar,
  JobPosting: Briefcase,
  Course: GraduationCap,
  Recipe: Utensils,
  Review: Star,
};

export default function SchemaGenerator() {
  const [selectedType, setSelectedType] = useState<SchemaType>("Organization");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generatedSchema, setGeneratedSchema] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const schema: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": selectedType,
    };

    const fields = schemaConfigs[selectedType];

    fields.forEach((field) => {
      const value = formData[field.name];
      if (!value) return;

      if (field.name === "faqs" && selectedType === "FAQPage") {
        const faqs = value.split("\n").filter(Boolean).map((line) => {
          const [question, answer] = line.split("|").map((s) => s.trim());
          if (question && answer) {
            return {
              "@type": "Question",
              name: question,
              acceptedAnswer: {
                "@type": "Answer",
                text: answer,
              },
            };
          }
          return null;
        }).filter(Boolean);
        schema.mainEntity = faqs;
      } else if (field.name === "steps" && selectedType === "HowTo") {
        schema.step = value.split("\n").filter(Boolean).map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          text: step.trim(),
        }));
      } else if (field.name === "ingredients" && selectedType === "Recipe") {
        schema.recipeIngredient = value.split("\n").filter(Boolean);
      } else if (field.name === "instructions" && selectedType === "Recipe") {
        schema.recipeInstructions = value.split("\n").filter(Boolean).map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          text: step.trim(),
        }));
      } else if (field.name === "sameAs") {
        schema.sameAs = value.split("\n").filter(Boolean);
      } else if (field.name === "address" && selectedType === "LocalBusiness") {
        schema.address = {
          "@type": "PostalAddress",
          streetAddress: value,
        };
      } else if (field.name === "openingHours") {
        schema.openingHoursSpecification = {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: value.split(",").map((d) => d.trim().split(" ")[0]),
          opens: value.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/)?.[1] || "",
          closes: value.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/)?.[2] || "",
        };
      } else if (field.name === "rating" && selectedType === "Product") {
        schema.aggregateRating = {
          "@type": "AggregateRating",
          ratingValue: value,
          reviewCount: formData.reviewCount || "0",
        };
      } else if (field.name === "price" && selectedType === "Product") {
        schema.offers = {
          "@type": "Offer",
          price: value,
          priceCurrency: formData.priceCurrency || "USD",
          availability: `https://schema.org/${formData.availability || "InStock"}`,
        };
      } else if (field.name === "employmentType") {
        schema[field.name] = value;
      } else if (field.name === "searchUrl" && selectedType === "WebSite") {
        schema.potentialAction = {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: value,
          },
          "query-input": "required name=search_term_string",
        };
      } else {
        schema[field.name] = value;
      }
    });

    setGeneratedSchema(JSON.stringify(schema, null, 2));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSchema = () => {
    const blob = new Blob([generatedSchema], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedType.toLowerCase()}-schema.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const Icon = schemaIcons[selectedType];
  const fields = schemaConfigs[selectedType];

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                <Code size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Schema Markup Generator</h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Generate JSON-LD structured data for rich snippets</p>
          </div>
          <a href="/dashboard/seo-tools" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-400 hover:text-cyan-300">← Quay lại</a>
        </div>

        {/* Schema Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(schemaConfigs) as SchemaType[]).map((type) => {
            const TypeIcon = schemaIcons[type];
            return (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setFormData({}); setGeneratedSchema(""); }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                  selectedType === type
                    ? "bg-cyan-500/20 border-2 border-cyan-500"
                    : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                }`}
              >
                <TypeIcon size={20} className={selectedType === type ? "text-cyan-400" : "text-gray-400"} />
                <span className={`text-xs font-bold ${selectedType === type ? "text-cyan-400" : "text-gray-400"}`}>{type}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Icon size={16} className="text-cyan-400" />
              </div>
              <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{selectedType} Schema</h3>
            </div>

            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    {field.label}
                    {field.required && <span className="text-rose-400 ml-1">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                      style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                    >
                      <option value="">Chọn...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold resize-none"
                      style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                      style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              className="w-full mt-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider transition-all"
            >
              Generate Schema
            </button>
          </div>

          {/* Output */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>JSON-LD Output</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  disabled={!generatedSchema}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm font-bold transition-all"
                  style={{ color: "var(--text-primary)" }}
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={downloadSchema}
                  disabled={!generatedSchema}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
                >
                  <Download size={14} /> JSON
                </button>
              </div>
            </div>

            <div className="relative">
              <pre
                className="rounded-xl p-4 text-xs font-mono overflow-auto max-h-[500px]"
                style={{ backgroundColor: "var(--hover-bg)", color: "var(--text-primary)", border: "1px solid rgba(6,182,212,0.1)" }}
              >
                {generatedSchema || "// Schema will appear here after generation..."}
              </pre>
            </div>

            {generatedSchema && (
              <div className="mt-4 rounded-xl p-3" style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.1)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <strong className="text-cyan-400">Cách sử dụng:</strong> Copy code JSON-LD trên và dán vào thẻ {'<script type="application/ld+json">'} trong phần {'<head>'} của trang HTML.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
