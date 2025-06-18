"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Search,
  BarChart3,
  Lightbulb
} from "lucide-react";
import { useLearningPreferences } from "@/hooks/use-learning-preferences";
import { LearningPreference } from "@/lib/learning-preferences";

interface AddPreferenceFormData {
  category: string;
  preference_key: string;
  preference_value: string;
  weight: number;
}

const WEIGHT_LABELS: Record<number, string> = {
  10: "Love it",
  9: "Really like",
  8: "Like",
  7: "Somewhat like",
  6: "Slightly like",
  5: "Lean towards",
  4: "Mildly prefer",
  3: "Slightly prefer",
  2: "Minor preference",
  1: "Weak preference",
  0: "Neutral",
  [-1]: "Weak dislike",
  [-2]: "Minor dislike",
  [-3]: "Slightly dislike",
  [-4]: "Mildly dislike",
  [-5]: "Lean away from",
  [-6]: "Slightly avoid",
  [-7]: "Somewhat dislike",
  [-8]: "Dislike",
  [-9]: "Really dislike",
  [-10]: "Strongly avoid"
};

const CATEGORIES = [
  "topic",
  "style", 
  "format",
  "approach",
  "subject",
  "tone",
  "complexity",
  "examples",
  "explanation",
  "other"
];

export function LearningPreferencesTab() {
  const {
    preferences,
    summary,
    loading,
    error,
    addPreference,
    updatePreference,
    deletePreference
  } = useLearningPreferences();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddPreferenceFormData>({
    category: "topic",
    preference_key: "",
    preference_value: "",
    weight: 0
  });

  // Filter preferences based on category and search
  const filteredPreferences = (Array.isArray(preferences) ? preferences : []).filter(pref => {
    const matchesCategory = selectedCategory === "all" || pref.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      pref.preference_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pref.preference_value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pref.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleAddPreference = useCallback(async () => {
    if (!addForm.preference_key.trim()) return;

    try {
      await addPreference({
        category: addForm.category,
        preference_key: addForm.preference_key.trim(),
        preference_value: addForm.preference_value.trim() || undefined,
        weight: addForm.weight,
        source: "manual",
        confidence: 1.0
      });

      setAddForm({
        category: "topic",
        preference_key: "",
        preference_value: "",
        weight: 0
      });
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to add preference:", error);
    }
  }, [addForm, addPreference]);

  const handleUpdateWeight = async (preference: LearningPreference, newWeight: number) => {
    try {
      await updatePreference({
        ...preference,
        weight: newWeight
      });
    } catch (error) {
      console.error("Failed to update preference:", error);
    }
  };

  const handleDeletePreference = async (id: string) => {
    try {
      await deletePreference(id);
    } catch (error) {
      console.error("Failed to delete preference:", error);
    }
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 7) return "text-green-600 dark:text-green-400";
    if (weight >= 3) return "text-blue-600 dark:text-blue-400";
    if (weight <= -7) return "text-red-600 dark:text-red-400";
    if (weight <= -3) return "text-orange-600 dark:text-orange-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getWeightBadgeVariant = (weight: number): "default" | "secondary" | "destructive" | "outline" => {
    if (weight >= 7) return "default";
    if (weight >= 3) return "secondary";
    if (weight <= -7) return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="text-2xl font-bold">{summary?.total_preferences || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Strong Likes</p>
                <p className="text-2xl font-bold text-green-600">{summary?.strong_likes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Strong Dislikes</p>
                <p className="text-2xl font-bold text-red-600">{summary?.strong_dislikes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Categories</p>
                <p className="text-2xl font-bold">{summary?.categories?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search preferences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(summary?.categories || []).map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="sm"
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Preference
        </Button>
      </div>

      {/* Add Preference Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Preference</CardTitle>
            <CardDescription>
              Define what you like or dislike to help improve your chat experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={addForm.category}
                  onValueChange={(value) => setAddForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Preference Key</Label>
                <Input
                  placeholder="e.g., technology, formal writing"
                  value={addForm.preference_key}
                  onChange={(e) => setAddForm(prev => ({ ...prev, preference_key: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Additional context or description"
                value={addForm.preference_value}
                onChange={(e) => setAddForm(prev => ({ ...prev, preference_value: e.target.value }))}
              />
            </div>

            <div>
              <Label>Weight: {addForm.weight} ({WEIGHT_LABELS[addForm.weight]})</Label>
              <Slider
                value={[addForm.weight]}
                onValueChange={(values) => setAddForm(prev => ({ ...prev, weight: values[0] }))}
                min={-10}
                max={10}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Strongly Avoid (-10)</span>
                <span>Neutral (0)</span>
                <span>Love It (+10)</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddPreference} disabled={!addForm.preference_key.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Preference
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Preferences List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading preferences...</p>
          </div>
        )}

        {!loading && filteredPreferences.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No preferences found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || selectedCategory !== "all" 
                  ? "No preferences match your current filters."
                  : "Start by adding some preferences to improve your chat experience."
                }
              </p>
              {!searchTerm && selectedCategory === "all" && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Preference
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {filteredPreferences.map((preference) => (
          <Card key={preference.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {preference.category}
                    </Badge>
                    <Badge 
                      variant={getWeightBadgeVariant(preference.weight)}
                      className={getWeightColor(preference.weight)}
                    >
                      {preference.weight > 0 ? '+' : ''}{preference.weight}
                    </Badge>
                  </div>
                  
                  <h4 className="font-medium truncate">{preference.preference_key}</h4>
                  {preference.preference_value && (
                    <p className="text-sm text-muted-foreground truncate">
                      {preference.preference_value}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Source: {preference.source}</span>
                    <span>Updated: {new Date(preference.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <div className="w-32">
                    <Slider
                      value={[preference.weight]}
                      onValueChange={(values) => handleUpdateWeight(preference, values[0])}
                      min={-10}
                      max={10}
                      step={1}
                      className="cursor-pointer"
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePreference(preference.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Learning Tips */}
      {(summary?.total_preferences || 0) < 10 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">Learning Tips</h4>
                <p className="text-sm text-muted-foreground">
                  Add more preferences to help the AI better understand your style. The system learns from your chat summaries and can automatically detect patterns in your conversations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}