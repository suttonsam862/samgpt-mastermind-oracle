
import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Model {
  id: string;
  name: string;
  description: string;
  tag?: 'default' | 'fast' | 'creative' | 'precise';
}

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelectModel,
}) => {
  const tagColors = {
    default: 'bg-blue-500',
    fast: 'bg-green-500',
    creative: 'bg-purple-500',
    precise: 'bg-amber-500',
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2 text-samgpt-text/80">
        Model
      </label>
      <Select
        value={selectedModel}
        onValueChange={onSelectModel}
      >
        <SelectTrigger className="w-full bg-samgpt-darkgray border-samgpt-lightgray">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent className="bg-samgpt-darkgray border-samgpt-lightgray">
          {models.map((model) => (
            <SelectItem 
              key={model.id} 
              value={model.id}
              className="focus:bg-samgpt-lightgray focus:text-samgpt-text"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span>{model.name}</span>
                  {model.tag && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full text-white",
                      tagColors[model.tag]
                    )}>
                      {model.tag}
                    </span>
                  )}
                </div>
                <span className="text-xs text-samgpt-text/50">
                  {model.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;
