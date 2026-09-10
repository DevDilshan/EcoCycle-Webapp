using backend.Models;
using backend.Services;

namespace backend.Tests.Compliance;

public class ComplianceRulesTests
{
    [Theory]
    [InlineData("Clean cardboard, no contamination visible")]
    [InlineData("Uncontaminated plastic bottles")]
    [InlineData("Bottles only, not mixed with anything")]
    [InlineData("Paper without contamination")]
    [InlineData("Glass jars, free of contamination")]
    public void Negated_mixed_waste_wording_is_not_flagged(string reasoning)
    {
        Assert.Empty(ComplianceRules.Evaluate(WasteCategory.Recyclable, 0.95, reasoning));
    }

    [Theory]
    [InlineData("Mixed batteries and organic waste")]
    [InlineData("Cardboard contaminated with food")]
    [InlineData("Includes non-recyclable film")]
    public void Real_mixed_waste_wording_is_still_flagged(string reasoning)
    {
        Assert.Single(ComplianceRules.Evaluate(WasteCategory.Recyclable, 0.95, reasoning));
    }
}
