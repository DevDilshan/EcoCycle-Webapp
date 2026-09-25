using backend.Models;

namespace backend.DTOs;

// Bound from the query string on GET /api/pickuprequests
public class PickupRequestQueryParams
{
    public PickupStatus? Status { get; set; }          // ?status=Pending
    public DateTime? FromDate { get; set; }            // ?fromDate=2026-09-01
    public DateTime? ToDate { get; set; }              // ?toDate=2026-09-30

    public string? SortBy { get; set; } = "createdAt"; // createdAt | preferredDate | status
    public string? SortDir { get; set; } = "desc";     // asc | desc

    private int _page = 1;
    public int Page { get => _page; set => _page = value < 1 ? 1 : value; }

    private int _pageSize = 10;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 100 ? 10 : value; // clamp 1..100
    }
}

// Generic paged envelope returned by the list endpoint
public class PagedResult<T>
{
    public IEnumerable<T> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}