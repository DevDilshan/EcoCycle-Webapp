using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Services;

public class ApprovalServiceTests
{
    private const string SamplePipelineJson = """
        {
          "classification": {
            "category": "Recyclable",
            "confidence": 0.85,
            "reasoning": "Plastic bottles",
            "image_used": true
          },
          "validation": {
            "is_valid": true,
            "violated_rules": ["LOW_CLASSIFICATION_CONFIDENCE"],
            "requires_approval": true
          },
          "approval": {
            "recommendation": "approve",
            "admin_summary": "Looks fine",
            "resident_notification": "We will collect as recyclables.",
            "reasoning": "Low risk"
          }
        }
        """;

    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _admin = Guid.NewGuid();

    private ApprovalService Service => new(
        _db,
        new NoOpAgentClient(),
        new RouteAssignmentService(_db, new RewardService(_db)),
        new RoutingOptionBuilder(_db),
        NullLogger<ApprovalService>.Instance);

    private (PickupRequest Pickup, ApprovalRequest Approval) AddPendingApproval(
        bool withPipelineJson = true,
        PickupStatus pickupStatus = PickupStatus.Classified)
    {
        var pickup = new PickupRequest
        {
            Description = "Mixed recyclables",
            PreferredDate = DateTime.UtcNow.AddDays(3),
            Status = pickupStatus,
        };
        _db.PickupRequests.Add(pickup);

        var approval = new ApprovalRequest
        {
            PickupRequestId = pickup.Id,
            FlagReason = "Low confidence classification",
            Status = ApprovalStatus.Pending,
            PipelineResultJson = withPipelineJson ? SamplePipelineJson : null,
        };
        _db.ApprovalRequests.Add(approval);
        _db.SaveChanges();
        return (pickup, approval);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_when_missing()
    {
        Assert.Null(await Service.GetByIdAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetByIdAsync_parses_stored_pipeline_into_agent_insight()
    {
        var (_, approval) = AddPendingApproval();

        var detail = await Service.GetByIdAsync(approval.Id);

        Assert.NotNull(detail);
        Assert.NotNull(detail!.AgentInsight);
        Assert.Equal("Recyclable", detail.AgentInsight!.Category);
        Assert.Equal(0.85, detail.AgentInsight.Confidence);
        Assert.Contains("LOW_CLASSIFICATION_CONFIDENCE", detail.AgentInsight.ViolatedRules);
        Assert.Equal("We will collect as recyclables.", detail.AgentInsight.ResidentNotification);
    }

    [Fact]
    public async Task GetByIdAsync_without_pipeline_sets_agent_note()
    {
        var (_, approval) = AddPendingApproval(withPipelineJson: false);

        var detail = await Service.GetByIdAsync(approval.Id);

        Assert.NotNull(detail);
        Assert.Null(detail!.AgentInsight);
        Assert.Contains("before the agent pipeline existed", detail.AgentResultNote);
    }

    [Fact]
    public async Task GetListAsync_filters_by_pending_status()
    {
        var (_, pending) = AddPendingApproval();
        var resolvedPickup = new PickupRequest
        {
            Description = "Done",
            PreferredDate = DateTime.UtcNow.AddDays(1),
            Status = PickupStatus.Rejected,
        };
        _db.PickupRequests.Add(resolvedPickup);
        _db.ApprovalRequests.Add(new ApprovalRequest
        {
            PickupRequestId = resolvedPickup.Id,
            FlagReason = "Hazardous",
            Status = ApprovalStatus.Rejected,
        });
        _db.SaveChanges();

        var page = await Service.GetListAsync(new ApprovalQueryParams
        {
            Status = ApprovalStatus.Pending,
            PageSize = 20,
        });

        Assert.Equal(1, page.TotalCount);
        Assert.Equal(pending.Id, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task ApproveAsync_marks_approval_and_pickup_approved()
    {
        var (pickup, approval) = AddPendingApproval();

        var result = await Service.ApproveAsync(approval.Id, _admin, new ApproveApprovalDto { Notes = "OK" });

        Assert.NotNull(result);
        Assert.Equal(nameof(ApprovalStatus.Approved), result!.Status);
        Assert.Equal(_admin, result.ReviewedByAdminId);

        var reloaded = await _db.PickupRequests.FindAsync(pickup.Id);
        Assert.Equal(PickupStatus.Approved, reloaded!.Status);
    }

    [Fact]
    public async Task ApproveAsync_non_pending_throws()
    {
        var (_, approval) = AddPendingApproval();
        await Service.RejectAsync(approval.Id, _admin, new RejectApprovalDto { Reason = "Not allowed" });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.ApproveAsync(approval.Id, _admin, new ApproveApprovalDto()));
    }

    [Fact]
    public async Task RejectAsync_marks_pickup_rejected()
    {
        var (pickup, approval) = AddPendingApproval();

        var result = await Service.RejectAsync(
            approval.Id, _admin, new RejectApprovalDto { Reason = "Cannot collect this item." });

        Assert.NotNull(result);
        Assert.Equal(nameof(ApprovalStatus.Rejected), result!.Status);

        var reloaded = await _db.PickupRequests.FindAsync(pickup.Id);
        Assert.Equal(PickupStatus.Rejected, reloaded!.Status);
    }

    [Fact]
    public async Task RequestRevisionAsync_resets_classified_pickup_to_pending()
    {
        var (pickup, approval) = AddPendingApproval();

        var result = await Service.RequestRevisionAsync(
            approval.Id, _admin, new RequestRevisionDto { Message = "Please add a clearer photo." });

        Assert.NotNull(result);
        Assert.Equal(nameof(ApprovalStatus.RevisionRequested), result!.Status);

        var reloaded = await _db.PickupRequests.FindAsync(pickup.Id);
        Assert.Equal(PickupStatus.Pending, reloaded!.Status);
    }

    private sealed class NoOpAgentClient : IAgentPipelineClient
    {
        public Task<PipelineResultDto?> RunPipelineAsync(
            RunPipelineRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<PipelineResultDto?>(null);

        public Task<RoutingDto?> RouteApprovedPickupAsync(
            RouteApprovedPickupRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<RoutingDto?>(null);

        public Task<RoutingDto?> ChooseSlotAsync(
            RoutingContextDto context, CancellationToken cancellationToken = default) =>
            Task.FromResult<RoutingDto?>(null);

        public Task<MissedExplanationDto?> ExplainMissedAsync(
            ExplainMissedRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<MissedExplanationDto?>(null);

        public Task<DecisionExplanationDto?> ExplainDecisionAsync(
            ExplainDecisionRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<DecisionExplanationDto?>(null);

        public Task<ImageValidationDto?> ValidateImageAsync(
            ValidateImageRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<ImageValidationDto?>(null);
    }
}
